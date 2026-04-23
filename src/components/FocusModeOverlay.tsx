import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Pause, Play, X, Square, RotateCcw,
  Minimize2, Maximize2, Sun, Moon, CircleDot,
  PictureInPicture2,
} from "lucide-react";
import { getFocusMessage } from "@/lib/focusMessages";
import { StudyMediaLinks } from "@/components/StudyMediaLinks";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { toast } from "sonner";

type FocusViewMode = "full" | "minimal";

interface FocusModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  formattedTime: string;
  elapsed: number;
  topicName?: string;
  subjectName?: string;
  running: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function FocusModeOverlay({
  isOpen, onClose, formattedTime, elapsed,
  topicName, subjectName, running,
  onPause, onResume, onStop, onReset,
}: FocusModeOverlayProps) {
  const [viewMode, setViewMode] = useState<FocusViewMode>("full");
  const [showMinimalControls, setShowMinimalControls] = useState(true);
  const { theme, setTheme } = useTheme();

  const message = useMemo(() => getFocusMessage(elapsed), [elapsed]);
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : CircleDot;
  const pip = usePictureInPicture();

  // Wire popup actions back to timer controls
  useEffect(() => {
    pip.onAction((action: string) => {
      if (action === "pause") onPause();
      else if (action === "resume") onResume();
      else if (action === "stop") onStop();
    });
  }, [pip.onAction, onPause, onResume, onStop]);

  // Keep PiP in sync
  useEffect(() => {
    if (pip.active) {
      pip.update(formattedTime, topicName || "", running);
    }
  }, [pip.active, pip.update, formattedTime, topicName, running]);

  const togglePiP = async () => {
    if (pip.active) {
      pip.close();
      return;
    }
    try {
      await pip.open(formattedTime, topicName || "", running);
      toast.success("Timer flutuante ativado!");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o timer flutuante");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setViewMode("full");
      setShowMinimalControls(true);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Escape") onClose();
      if (event.code === "Space" && !isEditable) {
        event.preventDefault();
        if (running) onPause();
        else onResume();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onPause, onResume, running]);

  useEffect(() => {
    if (!isOpen || viewMode !== "minimal" || !showMinimalControls) return;
    const timeout = window.setTimeout(() => setShowMinimalControls(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [isOpen, viewMode, showMinimalControls]);

  if (!isOpen) return null;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("black");
    else setTheme("light");
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "full" ? "minimal" : "full"));
    setShowMinimalControls(true);
  };

  const revealMinimalControls = () => {
    if (viewMode === "minimal") setShowMinimalControls(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-background/80 backdrop-blur-2xl"
      onMouseMove={revealMinimalControls}
      onClick={revealMinimalControls}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_35%)]" />

      {viewMode === "minimal" ? (
        <div className="relative flex min-h-screen items-center justify-center p-6">
          <div className="text-center select-none">
            {topicName && (
              <p className="mb-6 text-sm uppercase tracking-[0.2em] text-muted-foreground">{topicName}</p>
            )}
            <div className="text-7xl font-bold tracking-tight sm:text-8xl md:text-9xl">{formattedTime}</div>
          </div>

          {showMinimalControls && (
            <>
              <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                <div className="rounded-xl border border-white/10 bg-card/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md">Zen</div>
                <div className="flex items-center gap-2">
                  {pip.isSupported && (
                    <button onClick={togglePiP} title="Timer flutuante" className={`rounded-xl border bg-card/70 p-2 transition hover:text-foreground ${pip.active ? "text-primary" : "text-muted-foreground"}`}>
                      <PictureInPicture2 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={cycleTheme} className="rounded-xl border bg-card/70 p-2 text-muted-foreground transition hover:text-foreground">
                    <ThemeIcon className="h-4 w-4" />
                  </button>
                  <button onClick={toggleViewMode} className="rounded-xl border bg-card/70 p-2 text-muted-foreground transition hover:text-foreground">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button onClick={onClose} className="rounded-xl border bg-card/70 p-2 text-muted-foreground transition hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-card/75 px-4 py-3 backdrop-blur-md">
                {running ? (
                  <button onClick={onPause} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground">
                    <Pause className="h-4 w-4" /> Pausar
                  </button>
                ) : (
                  <button onClick={onResume} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground">
                    <Play className="h-4 w-4" /> Continuar
                  </button>
                )}
                <button onClick={onReset} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2">
                  <RotateCcw className="h-4 w-4" /> Zerar
                </button>
                <button onClick={onStop} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2">
                  <Square className="h-4 w-4" /> Encerrar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-screen items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-card/70 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 text-left">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground md:text-sm">
                  {subjectName || "Focus"}
                </p>
                <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
                  {topicName || "Sessão de estudo"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {pip.isSupported && (
                  <button onClick={togglePiP} title="Timer flutuante" className={`rounded-xl border bg-background/60 p-2 transition hover:bg-background hover:text-foreground ${pip.active ? "text-primary" : "text-muted-foreground"}`}>
                    <PictureInPicture2 className="h-5 w-5" />
                  </button>
                )}
                <button onClick={cycleTheme} className="rounded-xl border bg-background/60 p-2 text-muted-foreground transition hover:bg-background hover:text-foreground">
                  <ThemeIcon className="h-5 w-5" />
                </button>
                <button onClick={toggleViewMode} className="rounded-xl border bg-background/60 p-2 text-muted-foreground transition hover:bg-background hover:text-foreground">
                  <Minimize2 className="h-5 w-5" />
                </button>
                <button onClick={onClose} className="rounded-xl border bg-background/60 p-2 text-muted-foreground transition hover:bg-background hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl">{formattedTime}</div>
                <div className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-background/40 px-5 py-4">
                  <p className="text-sm text-muted-foreground md:text-lg">{message}</p>
                </div>
              </div>

              <div className="space-y-4 text-left">
                {/* Controls */}
                <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Controles</p>
                  <div className="mt-4 grid gap-3">
                    {running ? (
                      <button onClick={onPause} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                        <Pause className="h-4 w-4" /> Pausar
                      </button>
                    ) : (
                      <button onClick={onResume} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                        <Play className="h-4 w-4" /> Continuar
                      </button>
                    )}
                    <button onClick={onReset} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3">
                      <RotateCcw className="h-4 w-4" /> Zerar
                    </button>
                    <button onClick={onStop} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3">
                      <Square className="h-4 w-4" /> Encerrar sessão
                    </button>
                  </div>
                </div>

                {/* Spotify / YouTube */}
                <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Música</p>
                  <StudyMediaLinks />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
