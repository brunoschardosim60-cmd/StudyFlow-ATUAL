import { useState, useRef } from "react";
import { X, GripVertical } from "lucide-react";

export interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

const STICKY_COLORS = [
  { bg: "bg-yellow-200", border: "border-yellow-300", text: "text-yellow-900" },
  { bg: "bg-pink-200", border: "border-pink-300", text: "text-pink-900" },
  { bg: "bg-blue-200", border: "border-blue-300", text: "text-blue-900" },
  { bg: "bg-green-200", border: "border-green-300", text: "text-green-900" },
  { bg: "bg-purple-200", border: "border-purple-300", text: "text-purple-900" },
];

interface StickyNoteProps {
  note: StickyNoteData;
  onUpdate: (note: StickyNoteData) => void;
  onDelete: (id: string) => void;
  active: boolean;
}

export function StickyNote({ note, onUpdate, onDelete, active }: StickyNoteProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const noteRef = useRef<HTMLDivElement>(null);

  const colorIdx = ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#e9d5ff"].indexOf(note.color);
  const colors = STICKY_COLORS[colorIdx >= 0 ? colorIdx : 0];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = noteRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: e.clientX - rect.left - note.x,
      y: e.clientY - rect.top - note.y,
    };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent) => {
      const parentRect = noteRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      onUpdate({
        ...note,
        x: Math.max(0, Math.min(parentRect.width - note.width, ev.clientX - parentRect.left - dragOffset.current.x)),
        y: Math.max(0, Math.min(parentRect.height - note.height, ev.clientY - parentRect.top - dragOffset.current.y)),
      });
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      ref={noteRef}
      className={`absolute rounded-lg shadow-lg border ${colors.bg} ${colors.border} ${colors.text} ${
        isDragging ? "opacity-80 scale-105" : ""
      } transition-transform`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        minHeight: note.height,
        zIndex: 30,
      }}
    >
      <div className="flex items-center justify-between px-2 py-1 cursor-grab" onMouseDown={handleMouseDown}>
        <GripVertical className="w-3 h-3 opacity-50" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <textarea
        value={note.text}
        onChange={(e) => onUpdate({ ...note, text: e.target.value })}
        className={`w-full px-2 pb-2 bg-transparent resize-none outline-none text-sm ${colors.text}`}
        style={{ minHeight: note.height - 32 }}
        placeholder="Nota..."
        readOnly={!active}
      />
    </div>
  );
}
