import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

interface FocusMiniPlayerProps {
  visible: boolean;
  formattedTime: string;
  topicName?: string;
  running: boolean;
  onOpen: () => void;
}

export function FocusMiniPlayer({
  visible,
  formattedTime,
  topicName,
  running,
  onOpen,
}: FocusMiniPlayerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const initializedRef = useRef(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 16, y: 16 });
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = (nextX: number, nextY: number) => {
    const width = buttonRef.current?.offsetWidth ?? 240;
    const height = buttonRef.current?.offsetHeight ?? 56;
    const maxX = Math.max(16, window.innerWidth - width - 16);
    const maxY = Math.max(16, window.innerHeight - height - 16);

    return {
      x: Math.min(Math.max(16, nextX), maxX),
      y: Math.min(Math.max(16, nextY), maxY),
    };
  };

  useEffect(() => {
    if (!visible || initializedRef.current) return;

    const width = buttonRef.current?.offsetWidth ?? 240;
    const height = buttonRef.current?.offsetHeight ?? 56;
    setPosition({
      x: Math.max(16, window.innerWidth - width - 16),
      y: Math.max(16, window.innerHeight - height - 16),
    });
    initializedRef.current = true;
  }, [visible]);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    pointerIdRef.current = event.pointerId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    dragStartRef.current = position;
    draggingRef.current = false;
    setIsDragging(false);
    buttonRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const offsetX = event.clientX - pointerStartRef.current.x;
    const offsetY = event.clientY - pointerStartRef.current.y;
    const movement = Math.hypot(offsetX, offsetY);

    if (movement > 4) {
      draggingRef.current = true;
      setIsDragging(true);
    }

    const next = clampPosition(dragStartRef.current.x + offsetX, dragStartRef.current.y + offsetY);
    setPosition(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const wasDragging = draggingRef.current;
    pointerIdRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);

    if (buttonRef.current?.hasPointerCapture(event.pointerId)) {
      buttonRef.current.releasePointerCapture(event.pointerId);
    }

    if (!wasDragging) {
      onOpen();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ left: position.x, top: position.y }}
      className={`fixed z-50 rounded-full border border-border/50 bg-card/80 backdrop-blur-lg shadow-md px-4 py-2.5 touch-none transition-transform ${
        isDragging ? "scale-105 cursor-grabbing" : "cursor-grab hover:shadow-lg"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
        <span className="text-sm font-semibold tabular-nums text-foreground">{formattedTime}</span>
        {topicName && <span className="text-xs text-muted-foreground truncate max-w-[120px]">· {topicName}</span>}
      </div>
    </button>
  );
}
