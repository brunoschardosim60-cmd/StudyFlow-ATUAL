import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Pencil, Type, Maximize2, Minimize2, Share2,
  Brain, Sparkles, BookPlus, CheckCircle2, XCircle, ZoomIn, ZoomOut, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { RichEditor } from "@/components/notebook/RichEditor";
import {
  getStrokeBounds,
  getStrokesBounds,
  type Stroke,
  type DrawingCanvasRef,
} from "@/components/notebook/drawingTypes";
import { lazy, Suspense } from "react";
const KonvaDrawingCanvas = lazy(() =>
  import("@/components/notebook/KonvaDrawingCanvas").then((m) => ({ default: m.KonvaDrawingCanvas }))
);

// MathSuggestion type used locally in the editor
interface MathSuggestion {
  id: string;
  x: number;
  y: number;
  text: string;
  accepted: boolean;
  fontSize: number;
  createdAt: number;
  expiresAt: number;
  isError?: boolean;
  expression?: string;
  expressionLatex?: string;
  result?: string;
  resultLatex?: string;
  x_percent?: number;
  y_percent?: number;
  stroke_height?: number;
  is_correction?: boolean;
  user_answer?: boolean;
  steps?: string[];
  stepsLatex?: string[];
  confidence?: number;
}
import { DrawingToolbar } from "@/components/notebook/DrawingToolbar";
import { PageThumbnails } from "@/components/notebook/PageThumbnails";
import { ShareNotebookDialog } from "@/components/notebook/ShareNotebookDialog";
import { FloraSuggestionChip } from "@/components/notebook/FloraSuggestionChip";
import { StickyNote, type StickyNoteData } from "@/components/notebook/StickyNote";
import { ALL_SUBJECTS, createTopic, loadTopics, type Flashcard, type Subject } from "@/lib/studyData";
import { saveTopicsForUser } from "@/lib/studyStateStore";
import { toLocalDateStr } from "@/lib/dateUtils";
import { loadJsonStorage, loadStringStorage } from "@/lib/storage";
import { getNotebookAIActivities, recordAIActivity, type AIActivityItem } from "@/lib/aiActivityStore";
import { scheduleSpacedReviews } from "@/lib/spacedReviews";
import type { Json } from "@/integrations/supabase/types";

type PageTemplate = "blank" | "lined" | "grid" | "dotted" | "physics" | "chemistry" | "essay";

// Adapta DrawingState (que contém Date implicitamente nada, mas é typed local) para Json do Supabase.
function drawingToJson(d: DrawingState): Json {
  return JSON.parse(JSON.stringify(d)) as Json;
}

// Converte um row genérico do supabase para NotebookPage (drawing_data vem como Json | null).
function rowToNotebookPage(row: {
  id: string; notebook_id: string; user_id: string; page_number: number;
  content: string; drawing_data: Json | null; tags: string[];
}): NotebookPage {
  return {
    id: row.id,
    notebook_id: row.notebook_id,
    user_id: row.user_id,
    page_number: row.page_number,
    content: row.content,
    drawing_data: (row.drawing_data as unknown as DrawingState | null) ?? null,
    tags: row.tags ?? [],
  };
}

interface NotebookPage {
  id: string;
  notebook_id: string;
  user_id: string;
  page_number: number;
  content: string;
  drawing_data: DrawingState | null;
  tags: string[];
}

interface Notebook {
  id: string;
  title: string;
  subject: string | null;
  cover_color: string;
}

interface DrawingState {
  strokes: Stroke[];
  stickyNotes: StickyNoteData[];
  mathSuggestions: MathSuggestion[];
}

interface NotebookStudyLink {
  subject: Subject;
  topicId: string | null;
  topicTitle: string;
}

interface NotebookPageMeta {
  pinned: boolean;
  tags: string[];
}

interface NotebookQuizQuestion {
  pergunta: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
}

interface NotebookMathSolution {
  expression?: string;
  expression_latex?: string;
  result?: string;
  result_latex?: string;
  x_percent?: number;
  y_percent?: number;
  stroke_height?: number;
  is_correction?: boolean;
  user_answer?: boolean;
  steps?: string[];
  steps_latex?: string[];
  confidence?: number;
}

interface SolveMathResponse {
  solutions?: NotebookMathSolution[];
}

interface GenerateFlashcardsResponse {
  resumo?: string;
  flashcards?: Array<{
    frente: string;
    verso: string;
  }>;
}

interface GenerateQuizResponse {
  questions?: NotebookQuizQuestion[];
}

const emptyDrawing: DrawingState = { strokes: [], stickyNotes: [], mathSuggestions: [] };
const SUGGESTION_FADE_MS = 10_000;
const STATUS_RESOLVED_MS = 1500;
const SOLVE_COOLDOWN_MS = 2500;
const NOTEBOOK_LINKS_STORAGE_KEY = "studyflow.notebook.page-links";
const NOTEBOOK_AUTOSOLVE_STORAGE_KEY = "studyflow.notebook.auto-solver";
const NOTEBOOK_META_STORAGE_KEY = "studyflow.notebook.page-meta";
const NOTEBOOK_SUMMARIES_STORAGE_KEY = "studyflow.notebook.page-summaries";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeStrokesForHash = (strokes: Stroke[]) =>
  strokes
    .filter((stroke) => stroke.tool === "pen")
    .map((stroke) => {
      const first = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      const bounds = getStrokeBounds(stroke);
      return {
        p: stroke.points.length,
        w: Math.round(stroke.width),
        c: stroke.color,
        s: first ? `${Math.round(first.x)},${Math.round(first.y)}` : "",
        e: last ? `${Math.round(last.x)},${Math.round(last.y)}` : "",
        b: bounds
          ? `${Math.round(bounds.width)},${Math.round(bounds.height)}`
          : "",
      };
    });

const hashStrokes = (strokes: Stroke[]) => JSON.stringify(normalizeStrokesForHash(strokes));

const calculateAverageStrokeDistance = (strokes: Stroke[]) => {
  if (strokes.length < 2) return 0;

  const centers = strokes
    .map((stroke) => {
      const bounds = getStrokeBounds(stroke);
      if (!bounds) return null;
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    })
    .filter((center): center is { x: number; y: number } => center !== null);

  if (centers.length < 2) return 0;

  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const dx = centers[i].x - centers[j].x;
      const dy = centers[i].y - centers[j].y;
      sum += Math.hypot(dx, dy);
      pairs += 1;
    }
  }

  return pairs ? sum / pairs : 0;
};

const getAdaptiveDebounceMs = (strokes: Stroke[]) => {
  if (strokes.length <= 3) return 650;
  if (strokes.length <= 6) return 900;
  return 1200;
};

const hasLikelyMathTrigger = (strokes: Stroke[], canvasWidth: number) => {
  const horizontalStrokes = strokes
    .map((stroke) => ({ stroke, bounds: getStrokeBounds(stroke) }))
    .filter((item): item is { stroke: Stroke; bounds: NonNullable<ReturnType<typeof getStrokeBounds>> } => Boolean(item.bounds))
    .filter(({ bounds }) => bounds.width >= 20 && bounds.height > 0 && bounds.width / bounds.height >= 4);

  if (!horizontalStrokes.length) return false;

  for (let i = 0; i < horizontalStrokes.length; i++) {
    for (let j = i + 1; j < horizontalStrokes.length; j++) {
      const a = horizontalStrokes[i].bounds;
      const b = horizontalStrokes[j].bounds;
      const verticalDistance = Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
      const overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const minOverlap = Math.min(a.width, b.width) * 0.4;
      if (verticalDistance <= Math.max(12, canvasWidth * 0.02) && overlap >= minOverlap) {
        return true;
      }
    }
  }

  return horizontalStrokes.some(({ bounds }) => bounds.width >= canvasWidth * 0.12);
};

export default function NotebookEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [mode, setMode] = useState<"text" | "draw">("text");
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>("blank");
  const [expandedEditor, setExpandedEditor] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [drawTool, setDrawTool] = useState<"pen" | "marker" | "eraser" | "select" | "line" | "rect" | "circle">("pen");
  const [selectionBounds, setSelectionBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [penColor, setPenColor] = useState("#000000");
  const [penWidth, setPenWidth] = useState(2);
  const [autoSolveEnabled, setAutoSolveEnabled] = useState(() => {
    const stored = loadStringStorage(NOTEBOOK_AUTOSOLVE_STORAGE_KEY);
    return stored == null ? true : stored === "1";
  });
  const [solvingMath, setSolvingMath] = useState(false);
  const [mathStatus, setMathStatus] = useState<"idle" | "processing" | "resolved">("idle");
  const [lastMathSuggestion, setLastMathSuggestion] = useState<MathSuggestion | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject>("Matemática");
  const [pageLinks, setPageLinks] = useState<Record<string, NotebookStudyLink>>({});
  const [pageMeta, setPageMeta] = useState<Record<string, NotebookPageMeta>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [pageSummaries, setPageSummaries] = useState<Record<string, string>>({});
  const [aiActivities, setAiActivities] = useState<AIActivityItem[]>([]);
  const [generatingStudy, setGeneratingStudy] = useState<"none" | "flashcards" | "quiz">("none");
  const [quizDifficulty, setQuizDifficulty] = useState<"facil" | "medio" | "dificil">("medio");
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<NotebookQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizWrongQuestions, setQuizWrongQuestions] = useState<string[]>([]);
  const [quizResultSaved, setQuizResultSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solveCacheRef = useRef<Map<string, NotebookMathSolution[]>>(new Map());
  const previousResultsRef = useRef<NotebookMathSolution[]>([]);
  const lastSolvedHashRef = useRef<string | null>(null);
  const lastSolveAtRef = useRef(0);
  const solvingMathRef = useRef(false);
  const drawingStateRef = useRef<DrawingState>(emptyDrawing);
  const canvasRef = useRef<DrawingCanvasRef>(null);

  useEffect(() => {
    const savedLinks = loadJsonStorage<Record<string, NotebookStudyLink>>(NOTEBOOK_LINKS_STORAGE_KEY);
    setPageLinks(savedLinks ?? {});
  }, []);

  useEffect(() => {
    const savedMeta = loadJsonStorage<Record<string, NotebookPageMeta>>(NOTEBOOK_META_STORAGE_KEY);
    setPageMeta(savedMeta ?? {});
  }, []);

  useEffect(() => {
    const savedSummaries = loadJsonStorage<Record<string, string>>(NOTEBOOK_SUMMARIES_STORAGE_KEY);
    setPageSummaries(savedSummaries ?? {});
  }, []);

  const currentPageData = pages[currentPage] ?? null;

  useEffect(() => {
    if (!id || !currentPageData?.id) return;
    setAiActivities(getNotebookAIActivities(id, currentPageData.id));
  }, [id, currentPageData?.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (solveTimerRef.current) clearTimeout(solveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Zoom via mouse wheel (Ctrl+scroll) or pinch (touch)
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((prev) => clamp(prev - e.deltaY * 0.002, 0.25, 4));
      }
    };

    // Pinch-to-zoom (touch)
    let initialDistance = 0;
    let initialZoom = 1;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        setZoom((z) => {
          initialZoom = z;
          return z;
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance;
        setZoom(clamp(initialZoom * scale, 0.25, 4));
      }
    };

    const handleTouchEnd = () => {
      initialDistance = 0;
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTEBOOK_AUTOSOLVE_STORAGE_KEY, autoSolveEnabled ? "1" : "0");
  }, [autoSolveEnabled]);

  const loadData = useCallback(async () => {
    if (!id) {
      navigate("/notebooks");
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    try {
      const [nbRes, pagesRes] = await Promise.all([
        supabase.from("notebooks").select("*").eq("id", id).single(),
        supabase.from("notebook_pages").select("*").eq("notebook_id", id).order("page_number"),
      ]);

      if (nbRes.error || !nbRes.data) {
        toast.error("Caderno não encontrado");
        navigate("/notebooks");
        return;
      }

      setNotebook(nbRes.data);
      if (nbRes.data.subject && ALL_SUBJECTS.includes(nbRes.data.subject as Subject)) {
        setSelectedSubject(nbRes.data.subject as Subject);
      }

      if (!pagesRes.data || pagesRes.data.length === 0) {
        const { data, error } = await supabase
          .from("notebook_pages")
          .insert({
            notebook_id: id,
            user_id: user.id,
            page_number: 1,
            content: "",
            drawing_data: drawingToJson(emptyDrawing),
          })
          .select()
          .single();
        if (error || !data) {
          toast.error("Erro ao criar primeira página");
          navigate("/notebooks");
          return;
        }
        setPages([rowToNotebookPage(data)]);
      } else {
        setPages(pagesRes.data.map(rowToNotebookPage));
      }
    } catch (error) {
      console.error("Erro ao carregar caderno:", error);
      toast.error("Erro ao carregar caderno. Tente novamente.");
      navigate("/notebooks");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user]);

  useEffect(() => {
    if (user && id) {
      void loadData();
    }
  }, [id, loadData, user]);

  // More aggressive math detection for immediate response to = or /
  const hasCompletedMathExpression = (strokes: Stroke[]) => {
    if (strokes.length < 2) return false;
    
    const penStrokes = strokes.filter((stroke) => stroke.tool === "pen");
    if (penStrokes.length < 2) return false;

    const bounds = getStrokesBounds(penStrokes);
    if (!bounds) return false;

    const horizontalCount = penStrokes.filter((s) => {
      const b = getStrokeBounds(s);
      return b && b.width / b.height > 3;
    }).length;

    return horizontalCount >= 2 || penStrokes.length >= 4;
  };

  const page = pages[currentPage];
  const pageKey = id && page ? `${id}:${page.id}` : "";
  const currentLink = pageKey ? pageLinks[pageKey] : undefined;
  const currentSummary = pageKey ? pageSummaries[pageKey] : "";
  const currentMeta = pageKey ? pageMeta[pageKey] ?? { pinned: false, tags: [] } : { pinned: false, tags: [] };

  const getDrawingState = (): DrawingState => {
    if (!page?.drawing_data) return emptyDrawing;
    if (typeof page.drawing_data === "object" && page.drawing_data.strokes) {
      return page.drawing_data as DrawingState;
    }
    return emptyDrawing;
  };

  const drawingState = getDrawingState();

  useEffect(() => {
    drawingStateRef.current = drawingState;
  }, [drawingState]);

  useEffect(() => {
    solvingMathRef.current = solvingMath;
  }, [solvingMath]);

  const autoSave = useCallback((updates: Partial<Pick<NotebookPage, "content" | "drawing_data">>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!page) return;
      try {
        const updatePromise = Promise.all([
          supabase
            .from("notebook_pages")
            .update({
              ...(updates.content !== undefined ? { content: updates.content } : {}),
              ...(updates.drawing_data !== undefined
                ? { drawing_data: updates.drawing_data ? drawingToJson(updates.drawing_data) : null }
                : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", page.id),
          supabase
            .from("notebooks")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", id!),
        ]);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        await Promise.race([updatePromise, timeoutPromise]);
      } catch (error) {
        console.error("AutoSave error:", error);
      }
    }, 1000);
  }, [page, id]);

  const handleContentChange = (html: string) => {
    setPages((prev) =>
      prev.map((p, i) => (i === currentPage ? { ...p, content: html } : p))
    );
    autoSave({ content: html });
  };

  const updateDrawingState = useCallback((newState: DrawingState) => {
    setPages((prev) =>
      prev.map((p, i) => (i === currentPage ? { ...p, drawing_data: newState } : p))
    );
    autoSave({ drawing_data: newState });
  }, [autoSave, currentPage]);

  const removeSuggestionsNearStroke = useCallback((strokes: Stroke[], suggestions: MathSuggestion[]) => {
    if (!strokes.length || !suggestions.length) return suggestions;
    const latestStrokeBounds = getStrokeBounds(strokes[strokes.length - 1]);
    if (!latestStrokeBounds) return suggestions;

    const centerX = latestStrokeBounds.x + latestStrokeBounds.width / 2;
    const centerY = latestStrokeBounds.y + latestStrokeBounds.height / 2;

    return suggestions.filter((suggestion) => {
      const distance = Math.hypot(suggestion.x - centerX, suggestion.y - centerY);
      return distance > 40;
    });
  }, []);

  const handleStrokesChange = (strokes: Stroke[]) => {
    const filteredSuggestions = removeSuggestionsNearStroke(strokes, drawingState.mathSuggestions);
    updateDrawingState({ ...drawingState, strokes, mathSuggestions: filteredSuggestions });
    // Trigger auto-solve so AI can detect math expressions (=, ?, etc.)
    handleAutoSolve(strokes);
  };

  const handleStickyUpdate = (updatedNote: StickyNoteData) => {
    const newNotes = drawingState.stickyNotes.map((n) =>
      n.id === updatedNote.id ? updatedNote : n
    );
    updateDrawingState({ ...drawingState, stickyNotes: newNotes });
  };

  const handleStickyDelete = (noteId: string) => {
    const newNotes = drawingState.stickyNotes.filter((n) => n.id !== noteId);
    updateDrawingState({ ...drawingState, stickyNotes: newNotes });
  };

  const addStickyNote = (color: string) => {
    const newNote: StickyNoteData = {
      id: crypto.randomUUID(),
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 160,
      height: 120,
      text: "",
      color,
    };
    updateDrawingState({
      ...drawingState,
      stickyNotes: [...drawingState.stickyNotes, newNote],
    });
  };

  const undoStroke = () => {
    if (drawingState.strokes.length === 0) return;
    const newStrokes = drawingState.strokes.slice(0, -1);
    updateDrawingState({ ...drawingState, strokes: newStrokes });
  };

  const clearDrawing = () => {
    updateDrawingState({ ...drawingState, strokes: [], mathSuggestions: [] });
    previousResultsRef.current = [];
    setLastMathSuggestion(null);
    canvasRef.current?.clearCanvas();
  };

  const getSolveContext = useCallback((strokes: Stroke[]) => {
    const penStrokes = strokes.filter((stroke) => stroke.tool === "pen");
    const metrics = canvasRef.current?.getCanvasSize();
    const canvasWidth = metrics?.width || 800;
    const canvasHeight = metrics?.height || 600;
    return { penStrokes, canvasWidth, canvasHeight };
  }, []);

  const passesPrefilter = useCallback((strokes: Stroke[]) => {
    const { penStrokes, canvasWidth } = getSolveContext(strokes);
    if (penStrokes.length < 2) return false;

    const bounds = getStrokesBounds(penStrokes);
    if (!bounds) return false;

    const minSize = canvasWidth * 0.03;
    if (bounds.width < minSize || bounds.height < minSize) return false;

    const avgDistance = calculateAverageStrokeDistance(penStrokes);
    if (avgDistance > canvasWidth * 0.6) return false;

    // More aggressive trigger: either math pattern OR completed expression
    const hasMathPattern = hasLikelyMathTrigger(penStrokes, canvasWidth);
    const hasCompleted = hasCompletedMathExpression(penStrokes);

    return hasMathPattern || hasCompleted;
  }, [getSolveContext]);

  const setResolvedStatus = () => {
    setMathStatus("resolved");
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setMathStatus("idle");
    }, STATUS_RESOLVED_MS);
  };

  const buildSuggestions = useCallback((solutions: NotebookMathSolution[], strokes: Stroke[]): MathSuggestion[] => {
    const now = Date.now();
    const { canvasWidth, canvasHeight } = getSolveContext(strokes);

    return solutions.map((solution) => {
      const strokeHeightPercent = Number(solution.stroke_height ?? 0);
      const strokeHeightPx = (strokeHeightPercent / 100) * canvasHeight;
      const fontSize = clamp(strokeHeightPx || canvasWidth * 0.035, 14, 44);
      const isCorrection = Boolean(solution.is_correction) || solution.user_answer === false;
      const expression = String(solution.expression ?? "");
      const text = expression.includes("=") ? `= ${solution.result}` : String(solution.result ?? "");

      return {
        id: crypto.randomUUID(),
        x: (Number(solution.x_percent ?? 0) / 100) * canvasWidth,
        y: (Number(solution.y_percent ?? 0) / 100) * canvasHeight,
        text,
        accepted: false,
        fontSize,
        createdAt: now,
        expiresAt: now + SUGGESTION_FADE_MS,
        isError: isCorrection,
        expression,
        expressionLatex: typeof solution.expression_latex === "string" ? solution.expression_latex : undefined,
        result: String(solution.result ?? ""),
        resultLatex: typeof solution.result_latex === "string" ? solution.result_latex : undefined,
        steps: Array.isArray(solution.steps) ? solution.steps.map((step: unknown) => String(step)) : [],
        stepsLatex: Array.isArray(solution.steps_latex) ? solution.steps_latex.map((s: unknown) => String(s)) : undefined,
        confidence: Math.min(1, Math.max(0, Number(solution.confidence ?? 0.5))),
      };
    });
  }, [getSolveContext]);

  const applySolutions = useCallback((solutions: NotebookMathSolution[], strokes: Stroke[]) => {
    if (!solutions.length) {
      setMathStatus("idle");
      return;
    }

    const newSuggestions = buildSuggestions(solutions, strokes);
    const currentState = drawingStateRef.current;
    updateDrawingState({
      ...currentState,
      mathSuggestions: [...currentState.mathSuggestions, ...newSuggestions],
    });
    setLastMathSuggestion(newSuggestions[newSuggestions.length - 1] ?? null);
    setResolvedStatus();
  }, [buildSuggestions, updateDrawingState]);

  const solveMath = useCallback(async (strokes: Stroke[]) => {
    if (solvingMathRef.current) return;

    const imageData = canvasRef.current?.getImageData();
    if (!imageData) return;

    setSolvingMath(true);
    setMathStatus("processing");
    try {
      const { data, error } = await supabase.functions.invoke<SolveMathResponse>("solve-math", {
        body: {
          imageBase64: imageData,
          previousResults: previousResultsRef.current,
        },
      });

      if (error) throw error;

      if (data?.solutions && data.solutions.length > 0) {
        previousResultsRef.current = data.solutions;
        applySolutions(data.solutions, strokes);
      } else {
        setMathStatus("idle");
      }
    } catch (error) {
      console.error("Math solve error:", error);
      const now = Date.now();
      const errorSuggestion: MathSuggestion = {
        id: crypto.randomUUID(),
        x: 24,
        y: 40,
        text: "Erro ao resolver",
        accepted: false,
        fontSize: 18,
        createdAt: now,
        expiresAt: now + SUGGESTION_FADE_MS,
        isError: true,
        confidence: 0,
      };
      const currentState = drawingStateRef.current;
      updateDrawingState({
        ...currentState,
        mathSuggestions: [...currentState.mathSuggestions, errorSuggestion],
      });
      setLastMathSuggestion(errorSuggestion);
      setMathStatus("idle");
    } finally {
      setSolvingMath(false);
    }
  }, [applySolutions, updateDrawingState]);

  const handleAutoSolve = useCallback((strokes: Stroke[]) => {
    if (!autoSolveEnabled) return;
    if (solvingMathRef.current) return;
    if (!passesPrefilter(strokes)) return;

    const strokeHash = hashStrokes(strokes);
    const now = Date.now();
    if (strokeHash === lastSolvedHashRef.current && now - lastSolveAtRef.current < SOLVE_COOLDOWN_MS) {
      return;
    }

    const cachedSolutions = solveCacheRef.current.get(strokeHash);
    if (cachedSolutions) {
      applySolutions(cachedSolutions, strokes);
      lastSolvedHashRef.current = strokeHash;
      lastSolveAtRef.current = now;
      return;
    }

    if (solveTimerRef.current) clearTimeout(solveTimerRef.current);

    solveTimerRef.current = setTimeout(async () => {
      await solveMath(strokes);
      const latest = previousResultsRef.current;
      if (latest?.length) {
        solveCacheRef.current.set(strokeHash, latest);
        lastSolvedHashRef.current = strokeHash;
        lastSolveAtRef.current = Date.now();
      }
    }, getAdaptiveDebounceMs(strokes));
  }, [applySolutions, autoSolveEnabled, passesPrefilter, solveMath]);

  const handleManualSolveNow = useCallback(async () => {
    if (!autoSolveEnabled) {
      setMathStatus("idle");
    }

    const penStrokes = drawingState.strokes.filter((stroke) => stroke.tool === "pen");
    if (penStrokes.length < 2) {
      toast.info("Desenhe uma expressão antes de resolver.");
      return;
    }

    await solveMath(drawingState.strokes);
  }, [autoSolveEnabled, drawingState.strokes, solveMath]);

  const handleSolveSelection = useCallback(async () => {
    if (!selectionBounds) {
      toast.info("Selecione uma região primeiro (ferramenta de seleção).");
      return;
    }
    if (solvingMathRef.current) return;

    const imageData = canvasRef.current?.getImageData(selectionBounds);
    if (!imageData) {
      toast.error("Não foi possível recortar a região.");
      return;
    }

    setSolvingMath(true);
    setMathStatus("processing");
    try {
      const { data, error } = await supabase.functions.invoke<SolveMathResponse>("solve-math", {
        body: {
          imageBase64: imageData,
          previousResults: previousResultsRef.current,
        },
      });
      if (error) throw error;

      if (data?.solutions && data.solutions.length > 0) {
        previousResultsRef.current = data.solutions;
        applySolutions(data.solutions, drawingState.strokes);
        toast.success("Região resolvida.");
      } else {
        setMathStatus("idle");
        toast.info("Não consegui identificar uma expressão na região.");
      }
    } catch (error) {
      console.error("Solve selection error:", error);
      toast.error("Erro ao resolver a região.");
      setMathStatus("idle");
    } finally {
      setSolvingMath(false);
      canvasRef.current?.clearSelection?.();
      setSelectionBounds(null);
    }
  }, [applySolutions, drawingState.strokes, selectionBounds]);


  const confidenceLabel = (value: number | undefined) => {
    const confidence = value ?? 0;
    if (confidence >= 0.8) return { label: "Alta confiança", className: "text-secondary" };
    if (confidence >= 0.55) return { label: "Confiança média", className: "text-amber-600" };
    return { label: "Baixa confiança", className: "text-destructive" };
  };

  const handleSaveMathAsNote = () => {
    if (!lastMathSuggestion || !lastMathSuggestion.result) return;
    const parts = [
      `Expressão: ${lastMathSuggestion.expression || "(não identificada)"}`,
      `Resultado: ${lastMathSuggestion.result}`,
    ];
    if (lastMathSuggestion.steps?.length) {
      parts.push(`Passos: ${lastMathSuggestion.steps.join(" -> ")}`);
    }

    const noteBlock = `<p><strong>Solver:</strong> ${parts.join(" | ")}</p>`;
    handleContentChange(`${page?.content || ""}${noteBlock}`);
    pushAIActivity({
      type: "solver",
      title: "Resultado do solver salvo nas notas",
      detail: lastMathSuggestion.expression || lastMathSuggestion.result,
      notebookId: id,
      pageId: page?.id,
      topicId: currentLink?.topicId ?? undefined,
    });
    toast.success("Resultado salvo como anotação da página.");
  };

  const handleSaveMathAsFlashcard = async () => {
    if (!lastMathSuggestion?.result) return;
    const { allTopics, topic } = await ensureLinkedTopic();
    const expression = lastMathSuggestion.expression || "Expressão manuscrita";
    const confidenceInfo = confidenceLabel(lastMathSuggestion.confidence).label.toLowerCase();
    const card: Flashcard = {
      id: crypto.randomUUID(),
      frente: `Resolva: ${expression}`,
      verso: `${lastMathSuggestion.result} (${confidenceInfo})`,
    };

    const nextTopics = allTopics.map((item) => {
      if (item.id !== topic.id) return item;
      return { ...item, flashcards: [...item.flashcards, card] };
    });

    await saveTopicsForUser(user?.id, nextTopics);
    if (user?.id) {
      await scheduleSpacedReviews(user.id, topic.id, topic.materia);
    }
    pushAIActivity({
      type: "solver",
      title: "Resultado do solver virou flashcard",
      detail: expression,
      notebookId: id,
      pageId: page?.id,
      topicId: topic.id,
    });
    toast.success("Flashcard salvo. Revisões agendadas em 1, 3, 7 e 15 dias.");
  };

  const handleSaveMathAsExercise = async () => {
    if (!lastMathSuggestion?.result) return;
    const expression = lastMathSuggestion.expression || "Expressão manuscrita";
    const tema = `Exercício: ${expression.slice(0, 60)}`;
    const topic = createTopic(tema, selectedSubject, toLocalDateStr(new Date()), false);
    topic.notas = `Resultado esperado: ${lastMathSuggestion.result}\nPassos: ${(lastMathSuggestion.steps || []).join(" -> ")}`;

    const topics = loadTopics();
    await saveTopicsForUser(user?.id, [...topics, topic]);
    updateCurrentPageLink({ subject: selectedSubject, topicId: topic.id, topicTitle: topic.tema });
    pushAIActivity({
      type: "solver",
      title: "Resultado do solver virou exercício",
      detail: topic.tema,
      notebookId: id,
      pageId: page?.id,
      topicId: topic.id,
    });
    toast.success("Resultado salvo como exercício revisável.");
  };

  useEffect(() => {
    if (!drawingState.mathSuggestions.length) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const activeSuggestions = drawingState.mathSuggestions.filter(
        (suggestion) => (suggestion.expiresAt ?? now + 1) > now
      );
      if (activeSuggestions.length !== drawingState.mathSuggestions.length) {
        updateDrawingState({ ...drawingState, mathSuggestions: activeSuggestions });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [drawingState, updateDrawingState]);

  const addPage = async () => {
    const newPageNum = pages.length + 1;
    const { data } = await supabase
      .from("notebook_pages")
      .insert({
        notebook_id: id!,
        user_id: user!.id,
        page_number: newPageNum,
        content: "",
        drawing_data: drawingToJson(emptyDrawing),
      })
      .select()
      .single();
    if (data) {
      setPages((prev) => [...prev, rowToNotebookPage(data)]);
      setCurrentPage(pages.length);
      toast.success("Página adicionada!");
    }
  };

  const deletePage = async () => {
    if (pages.length <= 1) return;
    const pageToDelete = pages[currentPage];
    await supabase.from("notebook_pages").delete().eq("id", pageToDelete.id);
    const newPages = pages.filter((_, i) => i !== currentPage);
    setPages(newPages);
    setCurrentPage(Math.min(currentPage, newPages.length - 1));
  };

  const persistPageLinks = useCallback((next: Record<string, NotebookStudyLink>) => {
    setPageLinks(next);
    localStorage.setItem(NOTEBOOK_LINKS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistPageMeta = useCallback((next: Record<string, NotebookPageMeta>) => {
    setPageMeta(next);
    localStorage.setItem(NOTEBOOK_META_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistPageSummaries = useCallback((next: Record<string, string>) => {
    setPageSummaries(next);
    localStorage.setItem(NOTEBOOK_SUMMARIES_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateCurrentPageMeta = useCallback((updater: (prev: NotebookPageMeta) => NotebookPageMeta) => {
    if (!pageKey) return;
    const previous = pageMeta[pageKey] ?? { pinned: false, tags: [] };
    persistPageMeta({
      ...pageMeta,
      [pageKey]: updater(previous),
    });
  }, [pageKey, pageMeta, persistPageMeta]);

  const updateCurrentPageLink = useCallback((link: NotebookStudyLink) => {
    if (!pageKey) return;
    persistPageLinks({ ...pageLinks, [pageKey]: link });
  }, [pageKey, pageLinks, persistPageLinks]);

  const pushAIActivity = useCallback((activity: Omit<AIActivityItem, "id" | "createdAt">) => {
    const next = recordAIActivity(activity);
    if (!id || !page?.id) return;
    setAiActivities(next.filter((item) => item.notebookId === id && item.pageId === page.id).slice(0, 8));
  }, [id, page?.id]);

  const getPlainPageText = useCallback(() => {
    const html = page?.content || "";
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, [page?.content]);

  const ensureLinkedTopic = useCallback(async () => {
    const allTopics = loadTopics();
    const linked = currentLink?.topicId ? allTopics.find((t) => t.id === currentLink.topicId) : null;
    if (linked) return { allTopics, topic: linked };

    const text = getPlainPageText();
    const topicName = currentLink?.topicTitle || text.slice(0, 60) || `${notebook?.title || "Caderno"} - pág ${currentPage + 1}`;
    const newTopic = createTopic(topicName, selectedSubject, toLocalDateStr(new Date()), false);
    const nextTopics = [...allTopics, newTopic];
    await saveTopicsForUser(user?.id, nextTopics);
    updateCurrentPageLink({ subject: selectedSubject, topicId: newTopic.id, topicTitle: newTopic.tema });
    pushAIActivity({
      type: "topic",
      title: "Tópico criado automaticamente",
      detail: newTopic.tema,
      notebookId: id,
      pageId: page?.id,
      topicId: newTopic.id,
    });
    return { allTopics: nextTopics, topic: newTopic };
  }, [currentLink?.topicId, currentLink?.topicTitle, currentPage, getPlainPageText, id, notebook?.title, page?.id, pushAIActivity, selectedSubject, updateCurrentPageLink, user?.id]);

  const handleCreateTopicFromPage = async () => {
    const text = getPlainPageText();
    const topicName = text.slice(0, 60) || `${notebook?.title || "Caderno"} - pág ${currentPage + 1}`;
    const newTopic = createTopic(topicName, selectedSubject, toLocalDateStr(new Date()), false);
    const topics = loadTopics();
    await saveTopicsForUser(user?.id, [...topics, newTopic]);
    updateCurrentPageLink({ subject: selectedSubject, topicId: newTopic.id, topicTitle: newTopic.tema });
    pushAIActivity({
      type: "topic",
      title: "Tópico criado da página",
      detail: newTopic.tema,
      notebookId: id,
      pageId: page?.id,
      topicId: newTopic.id,
    });
    toast.success("Tópico criado a partir da página.");
  };

  const handleGenerateSummaryFromPage = async () => {
    try {
      const notes = getPlainPageText();
      if (!notes) {
        toast.info("Adicione conteúdo na página para gerar resumo.");
        return;
      }

        const { data, error } = await supabase.functions.invoke<GenerateFlashcardsResponse>("flora-engine", {
        body: {
          action: "generate_flashcards",
          userId: user?.id || "anonymous",
          data: {
            tema: currentLink?.topicTitle || notebook?.title || `Página ${currentPage + 1}`,
            materia: selectedSubject,
            pageContent: notes,
          },
        },
      });

      if (error) throw error;
      const summaryText = String(data?.resumo || "").trim();
      if (!summaryText) {
        toast.info("A IA não retornou resumo desta vez.");
        return;
      }

      if (pageKey) {
        persistPageSummaries({ ...pageSummaries, [pageKey]: summaryText });
      }
      pushAIActivity({
        type: "summary",
        title: "Resumo gerado",
        detail: summaryText.slice(0, 120),
        notebookId: id,
        pageId: page?.id,
        topicId: currentLink?.topicId ?? undefined,
      });
      toast.success("Resumo da página atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar resumo da página.");
    }
  };

  const handleGenerateFlashcardsFromPage = async () => {
    setGeneratingStudy("flashcards");
    try {
      const { allTopics, topic } = await ensureLinkedTopic();
      const notes = getPlainPageText();
      let summaryText = currentSummary;

      if (!summaryText) {
          const summaryRes = await supabase.functions.invoke<GenerateFlashcardsResponse>("flora-engine", {
          body: {
            action: "generate_flashcards",
            userId: user?.id || "anonymous",
            data: {
              tema: topic.tema,
              materia: topic.materia,
              pageContent: notes,
            },
          },
        });

        if (summaryRes.error) throw summaryRes.error;
        summaryText = (summaryRes.data?.resumo || "").trim();
        if (pageKey && summaryText) {
          persistPageSummaries({ ...pageSummaries, [pageKey]: summaryText });
        }
      }

      const notesForFlashcards = summaryText
        ? `Resumo da página:\n${summaryText}\n\nAnotações da página:\n${notes}`
        : notes;

        const { data, error } = await supabase.functions.invoke<GenerateFlashcardsResponse>("flora-engine", {
        body: {
          action: "generate_flashcards",
          userId: user?.id || "anonymous",
          data: {
            tema: topic.tema,
            materia: topic.materia,
            pageContent: notesForFlashcards,
          },
        },
      });
      if (error) throw error;

      const generated: Flashcard[] = (data?.flashcards || []).map((card) => ({
        id: crypto.randomUUID(),
        frente: card.frente,
        verso: card.verso,
      }));

      const dedupe = new Map<string, Flashcard>();
      const nextTopics = allTopics.map((t) => {
        if (t.id !== topic.id) return t;
        [...t.flashcards, ...generated].forEach((card) => {
          const key = `${card.frente.toLowerCase().trim()}::${card.verso.toLowerCase().trim()}`;
          if (!dedupe.has(key)) dedupe.set(key, card);
        });
        const mergedNotes = summaryText
          ? `Resumo automático da página:\n${summaryText}\n\n${notes || t.notas}`
          : notes || t.notas;
        return { ...t, notas: mergedNotes, flashcards: Array.from(dedupe.values()) };
      });

      await saveTopicsForUser(user?.id, nextTopics);
      if (pageKey && summaryText) {
        persistPageSummaries({ ...pageSummaries, [pageKey]: summaryText });
      }
      if (user?.id && generated.length > 0) {
        await scheduleSpacedReviews(user.id, topic.id, topic.materia);
      }
      pushAIActivity({
        type: "flashcards",
        title: "Flashcards gerados",
        detail: `${generated.length} cards para ${topic.tema}`,
        notebookId: id,
        pageId: page?.id,
        topicId: topic.id,
      });
      toast.success(`${generated.length} flashcards gerados. Revisões agendadas em 1, 3, 7 e 15 dias.`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar flashcards da página.");
    } finally {
      setGeneratingStudy("none");
    }
  };

  const resetNotebookQuiz = () => {
    setQuizQuestions([]);
    setQuizIndex(0);
    setQuizSelected(null);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizWrongQuestions([]);
    setQuizResultSaved(false);
  };

  const handleGenerateQuizFromPage = async () => {
    setGeneratingStudy("quiz");
    try {
      const { topic } = await ensureLinkedTopic();
      const notes = getPlainPageText();
      const { data, error } = await supabase.functions.invoke<GenerateQuizResponse>("flora-engine", {
        body: {
          action: "generate_quiz",
          userId: user?.id || "anonymous",
          data: {
            tema: topic.tema,
            materia: topic.materia,
            difficulty: quizDifficulty,
            pageContent: notes,
          },
        },
      });
      if (error) throw error;
      if (!Array.isArray(data?.questions) || data.questions.length === 0) throw new Error("Quiz vazio");

      resetNotebookQuiz();
      setQuizQuestions(data.questions);
      setQuizDialogOpen(true);
      pushAIActivity({
        type: "quiz",
        title: "Quiz gerado",
        detail: `${data.questions.length} perguntas para ${topic.tema}`,
        notebookId: id,
        pageId: page?.id,
        topicId: topic.id,
      });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar quiz da página.");
    } finally {
      setGeneratingStudy("none");
    }
  };

  const answerNotebookQuiz = (idx: number) => {
    if (quizSelected !== null) return;
    setQuizSelected(idx);
    if (idx === quizQuestions[quizIndex].correta) {
      setQuizScore((value) => value + 1);
    } else {
      setQuizWrongQuestions((prev) => [...prev, quizQuestions[quizIndex].pergunta]);
    }
  };

  const saveNotebookQuizResult = useCallback(async () => {
    if (quizResultSaved || quizQuestions.length === 0) return;

    const { allTopics, topic } = await ensureLinkedTopic();
    const normalized = quizQuestions.length > 0 ? quizScore / quizQuestions.length : 0;
    const nextTopics = allTopics.map((item) => {
      if (item.id !== topic.id) return item;
      const nextRating = Math.max(1, Math.min(5, Math.round(normalized * 5)));
      const nextErrors = [...(item.quizErrors ?? []), ...quizWrongQuestions].slice(-12);
      return {
        ...item,
        quizAttempts: (item.quizAttempts ?? 0) + 1,
        quizLastScore: normalized,
        quizErrors: nextErrors,
        rating: item.rating === 0 ? nextRating : Math.round((item.rating + nextRating) / 2),
      };
    });

    await saveTopicsForUser(user?.id, nextTopics);
    setQuizResultSaved(true);
    pushAIActivity({
      type: "quiz",
      title: "Resultado do quiz salvo",
      detail: `${quizScore}/${quizQuestions.length} em ${topic.tema}`,
      notebookId: id,
      pageId: page?.id,
      topicId: topic.id,
    });
  }, [ensureLinkedTopic, id, page?.id, pushAIActivity, quizQuestions.length, quizResultSaved, quizScore, quizWrongQuestions, user?.id]);

  const nextNotebookQuiz = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      void saveNotebookQuizResult();
      setQuizFinished(true);
      return;
    }
    setQuizIndex((value) => value + 1);
    setQuizSelected(null);
  };

  const searchAndJumpToPage = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const nextIndex = pages.findIndex((item) => {
      const html = item.content || "";
      const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();
      const key = id ? `${id}:${item.id}` : "";
      const meta = key ? pageMeta[key] : undefined;
      const tagMatch = (meta?.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
      return text.includes(query) || tagMatch;
    });

    if (nextIndex >= 0) {
      setCurrentPage(nextIndex);
      toast.success(`Ir para página ${nextIndex + 1}`);
    } else {
      toast.info("Nenhuma página encontrada para essa busca.");
    }
  };

  const handleSyncSummaryToTopic = async () => {
    if (!currentSummary.trim()) {
      toast.info("Gere um resumo antes de enviar para o tópico.");
      return;
    }

    const { allTopics, topic } = await ensureLinkedTopic();
    const nextTopics = allTopics.map((item) =>
      item.id === topic.id
        ? {
            ...item,
            notas: item.notas.trim()
              ? `${item.notas.trim()}\n\nResumo da página:\n${currentSummary}`
              : `Resumo da página:\n${currentSummary}`,
          }
        : item
    );

    await saveTopicsForUser(user?.id, nextTopics);
    pushAIActivity({
      type: "sync",
      title: "Resumo enviado ao tópico",
      detail: topic.tema,
      notebookId: id,
      pageId: page?.id,
      topicId: topic.id,
    });
    toast.success("Resumo enviado para o tópico vinculado.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background flex flex-col ${expandedEditor ? "fixed inset-0 z-50 overflow-auto" : ""}`}
      style={expandedEditor ? { touchAction: "pan-x pan-y pinch-zoom" } : undefined}
    >
      {/* Floating back button + mode dock in fullscreen */}
      {expandedEditor && (
        <>
          <button
            onClick={() => setExpandedEditor(false)}
            className="fixed top-3 left-3 z-[60] rounded-full bg-background/90 border border-border shadow-lg p-2.5 hover:bg-muted transition-colors backdrop-blur-sm"
            title="Voltar ao layout normal"
          >
            <Minimize2 className="w-5 h-5" />
          </button>

          {/* Floating mode dock: Texto / Desenhar / IA */}
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 rounded-full bg-background/90 border border-border shadow-lg px-1.5 py-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                mode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              title="Modo texto"
            >
              <Type className="w-4 h-4" />
              <span className="hidden sm:inline">Texto</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                mode === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              title="Modo desenho"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Desenhar</span>
            </button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              type="button"
              onClick={() => setAutoSolveEnabled((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                autoSolveEnabled ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
              title={autoSolveEnabled ? "IA ativa" : "IA inativa"}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">IA</span>
            </button>
          </div>
        </>
      )}

      {/* Header - auto-hide in fullscreen */}
      <header className={`border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40 transition-transform duration-300 ${
        expandedEditor ? "group/header hover:translate-y-0 -translate-y-full" : ""
      }`}
        onMouseEnter={(e) => { if (expandedEditor) e.currentTarget.style.transform = "translateY(0)"; }}
        onMouseLeave={(e) => { if (expandedEditor) e.currentTarget.style.transform = ""; }}
      >
        <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/notebooks")} className="h-11 w-11 sm:h-10 sm:w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading font-bold text-base sm:text-lg truncate min-w-0 flex-1">{notebook?.title}</h1>

          {/* Mode toggle */}
          <div className="order-4 sm:order-none w-full sm:w-auto flex items-center bg-muted rounded-lg p-0.5 gap-0.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-1 px-4 py-2 sm:px-3 sm:py-1 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Type className="w-4 h-4" />
              Texto
            </button>
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-1 px-4 py-2 sm:px-3 sm:py-1 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                mode === "draw" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Pencil className="w-4 h-4" />
              Desenhar
            </button>
          </div>

          <div className="order-6 sm:order-none w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2">
            <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as Subject)}>
              <SelectTrigger className="h-9 w-full sm:w-auto min-w-0 sm:min-w-[150px]">
                <SelectValue placeholder="Matéria" />
              </SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* AI toggle icon - works for both text and draw */}
            <button
              type="button"
              onClick={() => setAutoSolveEnabled((v) => !v)}
              className={`relative p-2 rounded-md transition-all ${
                autoSolveEnabled
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={autoSolveEnabled ? "IA ativa - clique para desativar" : "IA inativa - clique para ativar"}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto justify-center" disabled={generatingStudy !== "none"}>
                  {generatingStudy === "none" ? <BookPlus className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                  Ferramentas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ferramentas da página</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { handleGenerateSummaryFromPage().catch((error) => console.error(error)); }}>
                  Resumir página
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { handleGenerateFlashcardsFromPage().catch((error) => console.error(error)); }}>
                  Gerar flashcards
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { handleGenerateQuizFromPage().catch((error) => console.error(error)); }}>
                  Gerar quiz {quizDifficulty !== "medio" ? `(nível ${quizDifficulty})` : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { handleCreateTopicFromPage().catch((error) => console.error(error)); }}>
                  Criar tópico
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/redacao")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Redação ENEM
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setQuizDifficulty("facil")}>Quiz fácil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuizDifficulty("medio")}>Quiz médio</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuizDifficulty("dificil")}>Quiz difícil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  updateCurrentPageMeta((prev) => ({ ...prev, pinned: !prev.pinned }));
                }}>
                  {currentMeta.pinned ? "Desfixar página" : "Fixar página"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Template selector - separate from AI tools */}
            <Select value={pageTemplate} onValueChange={(v) => setPageTemplate(v as PageTemplate)}>
              <SelectTrigger className="h-9 w-full sm:w-auto min-w-0 sm:min-w-[130px]">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Branco</SelectItem>
                <SelectItem value="lined">Pautado</SelectItem>
                <SelectItem value="grid">Quadriculado</SelectItem>
                <SelectItem value="dotted">Pontilhado</SelectItem>
                <SelectItem value="physics">Física (eixos x/y)</SelectItem>
                <SelectItem value="chemistry">Química (hexagonal)</SelectItem>
                <SelectItem value="essay">Redação ENEM</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 rounded-md border px-2 py-1 w-full sm:w-auto">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchAndJumpToPage();
                }}
                placeholder="Buscar página"
                className="h-8 sm:h-7 w-full sm:w-32 bg-transparent text-sm outline-none"
              />
              <Button size="sm" variant="ghost" onClick={searchAndJumpToPage}>Ir</Button>
            </div>

            {currentLink?.topicTitle && (
              <span className="text-xs text-muted-foreground rounded-md border px-2 py-1 max-w-full sm:max-w-[260px] truncate">
                Vinculado: {currentLink.topicTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 order-3 sm:order-none">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareDialogOpen(true)}
              className="h-11 w-11 sm:h-8 sm:w-8"
              title="Compartilhar caderno"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpandedEditor((v) => !v)}
              className="h-11 w-11 sm:h-8 sm:w-8"
              title={expandedEditor ? "Sair do modo foco" : "Modo foco"}
            >
              {expandedEditor ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Page nav */}
          <div className="order-5 sm:order-none w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-1 sm:ml-auto pb-0.5 sm:pb-0">
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="h-11 w-11 sm:h-8 sm:w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center px-1">{currentPage + 1} / {pages.length}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1} className="h-11 w-11 sm:h-8 sm:w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={addPage} className="h-11 w-11 sm:h-8 sm:w-8">
              <Plus className="w-4 h-4" />
            </Button>
            {pages.length > 1 && (
              <Button variant="ghost" size="icon" onClick={deletePage} className="h-11 w-11 sm:h-8 sm:w-8 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Tags below header - hidden in fullscreen */}
      <div className={`${expandedEditor ? "hidden" : "container max-w-5xl mx-auto px-2 sm:px-4"} py-2 space-y-2`}>
        {currentSummary && (
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Resumo automático</p>
            <p className="text-sm text-foreground/90 max-h-16 overflow-y-auto">{currentSummary}</p>
          </div>
        )}

      </div>

      {/* Drawing toolbar when in draw mode */}
      {mode === "draw" && (
        <DrawingToolbar
          tool={drawTool}
          onToolChange={setDrawTool}
          penColor={penColor}
          onColorChange={setPenColor}
          penWidth={penWidth}
          onWidthChange={setPenWidth}
          onClear={clearDrawing}
          onUndo={undoStroke}
          onAddSticky={addStickyNote}
          mathStatus={mathStatus}
          autoSolveEnabled={autoSolveEnabled}
          onToggleAutoSolve={setAutoSolveEnabled}
          solvingMath={solvingMath}
          onSolveSelection={handleSolveSelection}
          hasSelection={Boolean(selectionBounds && selectionBounds.width > 8 && selectionBounds.height > 8)}
        />
      )}

      {/* Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Miniaturas de páginas — sidebar lateral */}
        {!expandedEditor && (
          <PageThumbnails
            pages={pages}
            currentPage={currentPage}
            onSelectPage={setCurrentPage}
            onAddPage={addPage}
            onDeletePage={(idx) => { setCurrentPage(idx === 0 ? 0 : idx - 1); deletePage(); }}
          />
        )}
      <div
        ref={editorContainerRef}
        className={`flex-1 overflow-auto ${expandedEditor ? "w-full h-full" : "px-2 sm:px-4 py-3 sm:py-4"}`}
      >
        <div className="relative min-h-full">
          <RichEditor
            content={page?.content || ""}
            onChange={handleContentChange}
            userId={user!.id}
            notebookId={id!}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
            template={pageTemplate}
            zoom={zoom}
            wide={expandedEditor}
            paperOverlay={
              <>
                <Suspense fallback={null}>
                  <KonvaDrawingCanvas
                    ref={canvasRef}
                    strokes={drawingState.strokes}
                    onStrokesChange={handleStrokesChange}
                    active={mode === "draw"}
                    penColor={penColor}
                    penWidth={penWidth}
                    tool={drawTool}
                    zoom={1}
                    onSelectionChange={setSelectionBounds}
                  />
                </Suspense>

                {mode === "draw" && solvingMath && (
                  <div className="absolute top-3 right-3 z-30 rounded-full bg-background/80 border border-border px-2 py-1 text-xs text-muted-foreground flex items-center gap-1.5 backdrop-blur-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processando
                  </div>
                )}

                {mode === "draw" && lastMathSuggestion?.result && (
                  <div className="absolute bottom-3 left-3 right-3 z-30 rounded-xl border border-border bg-background/90 backdrop-blur-sm p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">Solver:</span>
                        {lastMathSuggestion.expressionLatex ? (
                          <InlineMath math={lastMathSuggestion.expressionLatex} />
                        ) : (
                          <span>{lastMathSuggestion.expression || "expressão"}</span>
                        )}
                        <span className="text-muted-foreground">=</span>
                        {lastMathSuggestion.resultLatex ? (
                          <InlineMath math={lastMathSuggestion.resultLatex} />
                        ) : (
                          <span>{lastMathSuggestion.result}</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${confidenceLabel(lastMathSuggestion.confidence).className}`}>
                        {confidenceLabel(lastMathSuggestion.confidence).label}
                      </span>
                    </div>
                    {(lastMathSuggestion.stepsLatex?.length || lastMathSuggestion.steps?.length) ? (
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                        {(lastMathSuggestion.stepsLatex ?? []).length > 0
                          ? lastMathSuggestion.stepsLatex!.map((s, i) => (
                              <span key={i} className="flex items-center gap-2">
                                {i > 0 && <span>→</span>}
                                <InlineMath math={s} />
                              </span>
                            ))
                          : <span>{lastMathSuggestion.steps!.join(" → ")}</span>}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={handleSaveMathAsNote}>Salvar como anotação</Button>
                      <Button size="sm" variant="outline" onClick={() => { handleSaveMathAsFlashcard().catch((error) => console.error(error)); }}>Virar flashcard</Button>
                      <Button size="sm" onClick={() => { handleSaveMathAsExercise().catch((error) => console.error(error)); }}>Virar exercício revisável</Button>
                    </div>
                  </div>
                )}

                {/* Math overlays posicionados sobre o canvas (LaTeX) */}
                {mode === "draw" && drawingState.mathSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className={`absolute z-20 pointer-events-none rounded-md px-1.5 py-0.5 backdrop-blur-sm border ${
                      s.isError
                        ? "bg-destructive/10 border-destructive/30 text-destructive"
                        : "bg-background/80 border-border text-foreground"
                    }`}
                    style={{
                      left: s.x,
                      top: s.y,
                      fontSize: s.fontSize,
                      lineHeight: 1.1,
                    }}
                  >
                    {s.resultLatex ? (
                      <span><span className="text-muted-foreground">= </span><InlineMath math={s.resultLatex} /></span>
                    ) : (
                      <span>{s.text}</span>
                    )}
                  </div>
                ))}

                {/* Sticky notes */}
                {drawingState.stickyNotes.map((note) => (
                  <StickyNote
                    key={note.id}
                    note={note}
                    onUpdate={handleStickyUpdate}
                    onDelete={handleStickyDelete}
                    active={mode === "draw"}
                  />
                ))}
              </>
            }
          />
        </div>
      </div>

      </div>{/* end flex-1 overflow-hidden wrapper */}

      <Dialog
        open={quizDialogOpen}
        onOpenChange={(open) => {
          setQuizDialogOpen(open);
          if (!open) resetNotebookQuiz();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent" /> Quiz da página
            </DialogTitle>
          </DialogHeader>

          {quizQuestions.length > 0 && !quizFinished && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground flex justify-between">
                <span>Questão {quizIndex + 1} de {quizQuestions.length}</span>
                <span>Acertos: {quizScore}</span>
              </div>
              <p className="font-medium">{quizQuestions[quizIndex].pergunta}</p>

              <div className="space-y-2">
                {quizQuestions[quizIndex].alternativas.map((alternative, idx) => {
                  let style = "border-border hover:border-primary/40 hover:bg-primary/5";
                  if (quizSelected !== null) {
                    if (idx === quizQuestions[quizIndex].correta) style = "border-secondary bg-secondary/10";
                    else if (idx === quizSelected) style = "border-destructive bg-destructive/10";
                    else style = "border-border opacity-60";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => answerNotebookQuiz(idx)}
                      disabled={quizSelected !== null}
                      className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${style}`}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + idx)})</span>
                      {alternative}
                    </button>
                  );
                })}
              </div>

              {quizSelected !== null && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg text-sm ${quizSelected === quizQuestions[quizIndex].correta ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                    {quizSelected === quizQuestions[quizIndex].correta ? (
                      <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Correto</span>
                    ) : (
                      <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Incorreto</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{quizQuestions[quizIndex].explicacao}</p>
                  <Button onClick={nextNotebookQuiz} size="sm">
                    {quizIndex + 1 >= quizQuestions.length ? "Ver resultado" : "Próxima"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {quizFinished && (
            <div className="text-center py-4 space-y-3">
              <div className="text-2xl font-heading font-bold">{quizScore}/{quizQuestions.length}</div>
              <p className="text-sm text-muted-foreground">Desempenho desta página concluído.</p>
              <Button onClick={() => { setQuizDialogOpen(false); resetNotebookQuiz(); }}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compartilhamento */}
      {notebook && user && (
        <ShareNotebookDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          notebookId={id!}
          notebookTitle={notebook.title}
          userId={user.id}
        />
      )}

      {/* Flora contextual: chip discreto que reage ao texto da página */}
      <FloraSuggestionChip text={(page?.content || "").replace(/<[^>]+>/g, " ")} />
    </div>
  );
}
