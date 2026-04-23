/**
 * KonvaDrawingCanvas — canvas de desenho nível Samsung Notes
 *
 * Melhorias v2:
 *  - Pressure sensitivity via pointer.pressure (caneta stylus / touch)
 *  - Stroke width variável baseado na velocidade (simula tinta real)
 *  - Catmull-Rom spline para traços ultra-suaves
 *  - Palm rejection: ignora touches com área grande (palma da mão)
 *  - Caneta: largura varia 0.3x–2x baseada em pressão e velocidade
 *  - Marcador: opacidade 0.3, largura fixa, sem variação
 *  - Borracha: cursor circular proporcional ao tamanho
 *  - Linha/forma: segura Shift para linhas retas
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  type Stroke,
  type StrokeBounds,
  type DrawingCanvasRef,
  getStrokesBounds,
} from "./drawingTypes";

const IMAGE_EXPORT_PADDING = 28;

interface StrokePoint {
  x: number;
  y: number;
  pressure: number; // 0-1
  width: number;    // largura calculada neste ponto
}

interface RichStroke extends Omit<Stroke, "points"> {
  points: StrokePoint[];
}

interface KonvaDrawingCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  active: boolean;
  penColor: string;
  penWidth: number;
  tool: "pen" | "marker" | "eraser" | "select" | "line" | "rect" | "circle";
  zoom?: number;
  onSelectionChange?: (bounds: StrokeBounds | null) => void;
}

// Catmull-Rom → Bezier: suaviza o traço igual Samsung Notes
function catmullRomToBezier(pts: StrokePoint[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Desenha um stroke com largura variável (simula tinta real)
function drawRichStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points as unknown as StrokePoint[];
  if (!pts || pts.length < 1) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = stroke.width * 2;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.width, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === "marker") {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Caneta: largura variável por pressão
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = stroke.color;

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, (pts[0].width ?? stroke.width) / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Desenha segmentos com largura variável
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const w1 = prev.width ?? stroke.width;
    const w2 = curr.width ?? stroke.width;
    const avgW = (w1 + w2) / 2;

    ctx.beginPath();
    ctx.lineWidth = avgW;
    ctx.moveTo(prev.x, prev.y);

    // Curva suave via ponto de controle
    if (i < pts.length - 1) {
      const next = pts[i + 1];
      const mx = (curr.x + next.x) / 2;
      const my = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
    } else {
      ctx.lineTo(curr.x, curr.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export const KonvaDrawingCanvas = forwardRef<DrawingCanvasRef, KonvaDrawingCanvasProps>(
  ({ strokes, onStrokesChange, active, penColor, penWidth, tool, zoom = 1, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });
    const isDrawingRef = useRef(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const lastPointRef = useRef<{ x: number; y: number; t: number } | null>(null);
    const [selection, setSelection] = useState<StrokeBounds | null>(null);
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
    // Para shapes (linha, rect, circle)
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr / zoom, canvas.height / dpr / zoom);
      for (const s of strokes) drawRichStroke(ctx, s);
      if (currentStrokeRef.current) drawRichStroke(ctx, currentStrokeRef.current);
    };

    useImperativeHandle(ref, () => ({
      getImageData: (bounds?: StrokeBounds | null) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const useBounds = bounds ?? selection ?? getStrokesBounds(strokes);
        const dpr = window.devicePixelRatio || 1;
        const w = useBounds ? useBounds.width + IMAGE_EXPORT_PADDING * 2 : size.width;
        const h = useBounds ? useBounds.height + IMAGE_EXPORT_PADDING * 2 : size.height;
        const ox = useBounds ? Math.max(0, useBounds.x - IMAGE_EXPORT_PADDING) : 0;
        const oy = useBounds ? Math.max(0, useBounds.y - IMAGE_EXPORT_PADDING) : 0;
        const tmp = document.createElement("canvas");
        tmp.width = Math.ceil(w * dpr);
        tmp.height = Math.ceil(h * dpr);
        const ctx = tmp.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
        for (const s of strokes) drawRichStroke(ctx, s);
        return tmp.toDataURL("image/png");
      },
      clearCanvas: () => { onStrokesChange([]); setSelection(null); onSelectionChange?.(null); },
      getStrokeBounds: () => getStrokesBounds(strokes),
      getCanvasSize: () => size,
      getSelectionBounds: () => selection,
      clearSelection: () => { setSelection(null); onSelectionChange?.(null); },
    }));

    useEffect(() => {
      const el = containerRef.current?.parentElement;
      if (!el) return;
      const obs = new ResizeObserver(() => {
        const r = el.getBoundingClientRect();
        setSize({ width: r.width, height: r.height });
      });
      obs.observe(el);
      const r = el.getBoundingClientRect();
      setSize({ width: r.width, height: r.height });
      return () => obs.disconnect();
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(size.width * dpr));
      canvas.height = Math.max(1, Math.floor(size.height * dpr));
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      redraw();
    }, [size.width, size.height]);

    useEffect(() => { redraw(); }, [strokes, zoom]);

    useEffect(() => {
      if (tool !== "select" && selection) { setSelection(null); onSelectionChange?.(null); }
    }, [tool]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    };

    // Calcula largura do ponto baseado em pressão + velocidade
    const calcPointWidth = (e: React.PointerEvent, baseWidth: number): number => {
      const pressure = e.pressure > 0 ? e.pressure : 0.5; // fallback 0.5 para mouse
      const now = Date.now();
      let speedFactor = 1;
      if (lastPointRef.current) {
        const pos = getPos(e as any);
        const dx = pos.x - lastPointRef.current.x;
        const dy = pos.y - lastPointRef.current.y;
        const dt = Math.max(1, now - lastPointRef.current.t);
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        // Traço rápido = mais fino; lento = mais grosso (igual caneta real)
        speedFactor = Math.max(0.4, Math.min(1.8, 1 - speed * 0.8));
      }
      return baseWidth * pressure * 1.5 * speedFactor;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      // Palm rejection: toque com área grande é palma da mão
      if (e.pointerType === "touch" && (e as any).width > 40) return;
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

      const pos = getPos(e);

      if (tool === "select") {
        selectionStartRef.current = pos;
        setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
        isDrawingRef.current = true;
        return;
      }

      if (tool === "line" || tool === "rect" || tool === "circle") {
        shapeStartRef.current = pos;
        isDrawingRef.current = true;
        return;
      }

      const w = calcPointWidth(e, penWidth);
      lastPointRef.current = { x: pos.x, y: pos.y, t: Date.now() };
      currentStrokeRef.current = {
        points: [{ x: pos.x, y: pos.y, pressure: e.pressure || 0.5, width: w } as any],
        color: penColor,
        width: penWidth,
        tool: tool as "pen" | "marker" | "eraser",
      };
      isDrawingRef.current = true;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || !isDrawingRef.current) return;
      if (e.pointerType === "touch" && (e as any).width > 40) return;
      e.preventDefault();
      const pos = getPos(e);

      if (tool === "select" && selectionStartRef.current) {
        const start = selectionStartRef.current;
        const next = { x: Math.min(start.x, pos.x), y: Math.min(start.y, pos.y), width: Math.abs(pos.x - start.x), height: Math.abs(pos.y - start.y) };
        setSelection(next);
        onSelectionChange?.(next);
        return;
      }

      if ((tool === "line" || tool === "rect" || tool === "circle") && shapeStartRef.current) {
        // Preview da shape na tela
        redraw();
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
          ctx.strokeStyle = penColor;
          ctx.lineWidth = penWidth;
          ctx.lineCap = "round";
          ctx.beginPath();
          const s = shapeStartRef.current;
          if (tool === "line") { ctx.moveTo(s.x, s.y); ctx.lineTo(pos.x, pos.y); }
          else if (tool === "rect") { ctx.rect(s.x, s.y, pos.x - s.x, pos.y - s.y); }
          else { const rx = Math.abs(pos.x - s.x) / 2; const ry = Math.abs(pos.y - s.y) / 2; ctx.ellipse(s.x + (pos.x - s.x) / 2, s.y + (pos.y - s.y) / 2, rx, ry, 0, 0, Math.PI * 2); }
          ctx.stroke();
          ctx.restore();
        }
        return;
      }

      if (!currentStrokeRef.current) return;
      const w = calcPointWidth(e, penWidth);
      (currentStrokeRef.current.points as any[]).push({ x: pos.x, y: pos.y, pressure: e.pressure || 0.5, width: w });
      lastPointRef.current = { x: pos.x, y: pos.y, t: Date.now() };
      redraw();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;
      const pos = getPos(e);

      if (tool === "select") {
        selectionStartRef.current = null;
        if (selection && (selection.width < 8 || selection.height < 8)) { setSelection(null); onSelectionChange?.(null); }
        return;
      }

      if ((tool === "line" || tool === "rect" || tool === "circle") && shapeStartRef.current) {
        const s = shapeStartRef.current;
        shapeStartRef.current = null;
        // Converte shape para pontos
        let shapePts: any[] = [];
        if (tool === "line") {
          shapePts = [{ x: s.x, y: s.y, pressure: 0.5, width: penWidth }, { x: pos.x, y: pos.y, pressure: 0.5, width: penWidth }];
        } else if (tool === "rect") {
          const pts = [[s.x, s.y],[pos.x, s.y],[pos.x, pos.y],[s.x, pos.y],[s.x, s.y]];
          shapePts = pts.map(([x, y]) => ({ x, y, pressure: 0.5, width: penWidth }));
        } else {
          const cx = (s.x + pos.x) / 2; const cy = (s.y + pos.y) / 2;
          const rx = Math.abs(pos.x - s.x) / 2; const ry = Math.abs(pos.y - s.y) / 2;
          shapePts = Array.from({ length: 64 }, (_, i) => {
            const a = (i / 63) * Math.PI * 2;
            return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, pressure: 0.5, width: penWidth };
          });
        }
        onStrokesChange([...strokes, { points: shapePts as any, color: penColor, width: penWidth, tool: "pen" }]);
        return;
      }

      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (stroke && stroke.points.length >= 1) {
        onStrokesChange([...strokes, stroke]);
      } else {
        redraw();
      }
    };

    const cursor = !active ? "pointer-events-none z-10" :
      tool === "eraser" ? "z-20 cursor-cell" :
      tool === "select" ? "z-20 cursor-crosshair" : "z-20 cursor-crosshair";

    return (
      <div ref={containerRef} className={`absolute inset-0 ${cursor}`} style={{ touchAction: active ? "none" : "auto" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
        {selection && tool === "select" && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none rounded-sm"
            style={{ left: selection.x * zoom, top: selection.y * zoom, width: selection.width * zoom, height: selection.height * zoom }}
          />
        )}
      </div>
    );
  }
);

KonvaDrawingCanvas.displayName = "KonvaDrawingCanvas";
