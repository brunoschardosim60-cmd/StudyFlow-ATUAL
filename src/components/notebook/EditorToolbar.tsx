import { type Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Highlighter,
  List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, ImagePlus, Undo, Redo,
  Palette, Type as TypeIcon, ChevronDown, ChevronUp, Sigma,
} from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa",
];

interface EditorToolbarProps {
  editor: Editor | null;
  userId: string;
  notebookId: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function EditorToolbar({ editor, userId, notebookId, darkMode, onToggleDarkMode }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  if (!editor) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop();
    const path = `${userId}/${notebookId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("notebook-images")
      .upload(path, file);

    if (error) {
      toast.error("Erro ao enviar imagem");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("notebook-images")
      .getPublicUrl(path);

    editor.chain().focus().setImage({ src: publicUrl }).run();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const ToolBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-all ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  if (!expanded) {
    return (
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-1 bg-card/30">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          title="Mostrar formatação"
        >
          <TypeIcon className="w-3.5 h-3.5" />
          <span>Formatar</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-0.5">
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
            <Undo className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
            <Redo className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn active={darkMode} onClick={onToggleDarkMode} title={darkMode ? "Modo claro" : "Modo escuro"}>
            <Palette className="w-3.5 h-3.5" />
          </ToolBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-border px-3 py-1.5 bg-card/50 overflow-x-auto whitespace-nowrap">
      <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
        <Bold className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
        <Italic className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
        <Underline className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
        <Strikethrough className="w-4 h-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">
        <Heading1 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">
        <Heading2 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">
        <Heading3 className="w-4 h-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <List className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered className="w-4 h-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinhar esquerda">
        <AlignLeft className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centralizar">
        <AlignCenter className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinhar direita">
        <AlignRight className="w-4 h-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Highlights */}
      <div className="flex items-center gap-0.5">
        <Highlighter className="w-4 h-4 text-muted-foreground mr-0.5" />
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
            className={`w-4 h-4 rounded-sm border transition-all ${
              editor.isActive("highlight", { color }) ? "ring-2 ring-primary scale-110" : "border-border"
            }`}
            style={{ backgroundColor: color }}
            title="Destacar"
          />
        ))}
        {editor.isActive("highlight") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className="text-xs text-muted-foreground hover:text-foreground ml-1"
            title="Remover destaque"
          >
            ✕
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn onClick={() => fileInputRef.current?.click()} title="Inserir imagem">
        <ImagePlus className="w-4 h-4" />
      </ToolBtn>

      <ToolBtn
        onClick={() => {
          // insere $  $ inline e posiciona cursor entre os delimitadores
          editor.chain().focus().insertContent("$  $").run();
          // move cursor pra dentro dos $ (2 caracteres pra trás)
          const { from } = editor.state.selection;
          editor.commands.setTextSelection({ from: from - 2, to: from - 2 });
        }}
        title="Fórmula matemática inline ($...$). Use $$...$$ para bloco."
      >
        <Sigma className="w-4 h-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
        <Undo className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
        <Redo className="w-4 h-4" />
      </ToolBtn>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolBtn active={darkMode} onClick={onToggleDarkMode} title={darkMode ? "Modo claro" : "Modo escuro"}>
          <Palette className="w-4 h-4" />
        </ToolBtn>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          title="Esconder formatação"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}
