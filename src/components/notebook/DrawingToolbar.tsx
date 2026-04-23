import {
  Pencil, Eraser, Trash2, StickyNote, Undo2, Sparkles, BoxSelect,
  Minus, Square, Circle, Highlighter, Pen,
} from "lucide-react";

const PEN_COLORS = [
  "#000000", "#ef4444", "#3b82f6", "#22c55e",
  "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
];
const PEN_WIDTHS = [1.5, 3, 6, 10];
const STICKY_COLORS = ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#e9d5ff"];

export type DrawingTool = "pen" | "marker" | "eraser" | "select" | "line" | "rect" | "circle";

interface DrawingToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  penColor: string;
  onColorChange: (color: string) => void;
  penWidth: number;
  onWidthChange: (width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onAddSticky: (color: string) => void;
  mathStatus: "idle" | "processing" | "resolved";
  autoSolveEnabled: boolean;
  onToggleAutoSolve: (enabled: boolean) => void;
  solvingMath: boolean;
  onSolveSelection?: () => void;
  hasSelection?: boolean;
}

function ToolBtn({
  active, onClick, children, title,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
        active
          ? "bg-primary/20 text-primary ring-1 ring-primary/40"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function DrawingToolbar({
  tool, onToolChange, penColor, onColorChange, penWidth, onWidthChange,
  onClear, onUndo, onAddSticky, mathStatus, autoSolveEnabled,
  onToggleAutoSolve, solvingMath, onSolveSelection, hasSelection,
}: DrawingToolbarProps) {
  const statusDot: Record<string, string> = {
    idle: "",
    processing: "bg-sky-500 animate-pulse",
    resolved: "bg-emerald-500",
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5 bg-card/50">

      {/* Grupo: ferramentas de desenho */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/50 p-0.5">
        <ToolBtn active={tool === "pen"} onClick={() => onToolChange("pen")} title="Caneta (pressão)">
          <Pen className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={tool === "marker"} onClick={() => onToolChange("marker")} title="Marcador">
          <Highlighter className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={tool === "eraser"} onClick={() => onToolChange("eraser")} title="Borracha">
          <Eraser className="w-4 h-4" />
        </ToolBtn>
      </div>

      {/* Grupo: formas */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/50 p-0.5">
        <ToolBtn active={tool === "line"} onClick={() => onToolChange("line")} title="Linha reta">
          <Minus className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={tool === "rect"} onClick={() => onToolChange("rect")} title="Retângulo">
          <Square className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={tool === "circle"} onClick={() => onToolChange("circle")} title="Círculo/Elipse">
          <Circle className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={tool === "select"} onClick={() => onToolChange("select")} title="Selecionar área">
          <BoxSelect className="w-4 h-4" />
        </ToolBtn>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border/60 mx-0.5" />

      {/* Cores */}
      <div className="flex items-center gap-1 flex-wrap">
        {PEN_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColorChange(c)}
            title={c}
            className="rounded-full border-2 transition-all"
            style={{
              background: c,
              width: 18, height: 18,
              borderColor: penColor === c ? "hsl(var(--primary))" : "transparent",
              transform: penColor === c ? "scale(1.25)" : "scale(1)",
            }}
          />
        ))}
        {/* Cor personalizada */}
        <label title="Cor personalizada" className="cursor-pointer">
          <input
            type="color"
            value={penColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="sr-only"
          />
          <div
            className="rounded-full border-2 border-dashed border-border/60 hover:border-primary transition-all flex items-center justify-center text-[8px] text-muted-foreground"
            style={{ width: 18, height: 18 }}
          >
            +
          </div>
        </label>
      </div>

      <div className="h-6 w-px bg-border/60 mx-0.5" />

      {/* Espessura */}
      <div className="flex items-center gap-1">
        {PEN_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onWidthChange(w)}
            title={`Espessura ${w}px`}
            className={`rounded-full transition-all border ${
              penWidth === w
                ? "border-primary bg-primary/10"
                : "border-border/60 hover:border-primary/40"
            }`}
            style={{ width: Math.max(14, w * 2.5), height: Math.max(14, w * 2.5) }}
          >
            <div
              className="rounded-full mx-auto"
              style={{
                width: Math.max(4, w * 1.2),
                height: Math.max(4, w * 1.2),
                background: penColor,
              }}
            />
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-border/60 mx-0.5" />

      {/* Sticky notes */}
      <div className="flex items-center gap-0.5">
        {STICKY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onAddSticky(c)}
            title="Adicionar nota adesiva"
            className="rounded border border-border/40 hover:border-primary/40 transition-all"
            style={{ background: c, width: 18, height: 18 }}
          />
        ))}
      </div>

      <div className="h-6 w-px bg-border/60 mx-0.5" />

      {/* IA Matemática */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleAutoSolve(!autoSolveEnabled)}
          title={autoSolveEnabled ? "IA matemática: ativa" : "IA matemática: inativa"}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all border ${
            autoSolveEnabled
              ? "bg-primary/10 text-primary border-primary/30"
              : "text-muted-foreground border-border/60 hover:border-primary/30"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">IA</span>
          {mathStatus !== "idle" && (
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[mathStatus]}`} />
          )}
        </button>

        {tool === "select" && hasSelection && onSolveSelection && (
          <button
            type="button"
            onClick={onSolveSelection}
            disabled={solvingMath}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {solvingMath ? (
              <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Resolver</span>
          </button>
        )}
      </div>

      {/* Undo / Clear */}
      <div className="flex items-center gap-0.5 ml-auto">
        <ToolBtn onClick={onUndo} title="Desfazer (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn onClick={onClear} title="Limpar canvas">
          <Trash2 className="w-4 h-4 text-destructive" />
        </ToolBtn>
      </div>
    </div>
  );
}
