import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useEffect, useRef, type ReactNode } from "react";
import { EditorToolbar } from "./EditorToolbar";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  userId: string;
  notebookId: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  template?: "blank" | "lined" | "grid" | "dotted" | "physics" | "chemistry" | "essay";
  zoom?: number;
  /** Overlay rendered on top of the paper sheet (e.g. drawing canvas, sticky notes). */
  paperOverlay?: ReactNode;
  /** When true, paper takes more horizontal space (focus/fullscreen mode). */
  wide?: boolean;
}

const TEMPLATE_CLASS: Record<string, string> = {
  blank: "",
  lined: "notebook-lined",
  grid: "notebook-grid",
  dotted: "notebook-dotted",
  physics: "notebook-physics",
  chemistry: "notebook-chemistry",
  essay: "notebook-essay",
};

export function RichEditor({ content, onChange, userId, notebookId, darkMode, onToggleDarkMode, template = "blank", zoom = 1, paperOverlay, wide = false }: RichEditorProps) {
  const isExternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
    ],
    content: content || "<p></p>",
    onUpdate: ({ editor }) => {
      if (!isExternalUpdate.current) {
        onChange(editor.getHTML());
      }
    },
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[60vh] notebook-paper-text",
        },
      },
  });

  // Sync external content changes (page switches)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isExternalUpdate.current = true;
      editor.commands.setContent(content || "<p></p>");
      isExternalUpdate.current = false;
    }
  }, [content, editor]);

  return (
    <div className={`flex flex-col h-full ${darkMode ? "text-gray-100" : ""}`}>
      <EditorToolbar
        editor={editor}
        userId={userId}
        notebookId={notebookId}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
      <div className="flex-1 overflow-auto py-4 sm:py-6 px-2 sm:px-4">
        <div
          className={`relative mx-auto ${wide ? "max-w-[1100px]" : "max-w-[800px]"} rounded-2xl transition-shadow duration-300 animate-fade-in ${
            darkMode
              ? "bg-gray-900 shadow-[0_8px_30px_rgba(0,0,0,0.5)] [&_.ProseMirror]:text-gray-100 [&_.ProseMirror_h1]:text-gray-50 [&_.ProseMirror_h2]:text-gray-50 [&_.ProseMirror_h3]:text-gray-50"
              : "bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
          } ${TEMPLATE_CLASS[template] || ""}`}
          style={{
            padding: "40px",
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
        >
          <EditorContent editor={editor} className="min-h-screen" />
          {paperOverlay}
        </div>
      </div>
    </div>
  );
}
