import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Essay = Tables<"essays">;

export interface ParagrafoAnalise {
  diagnostico: string;
  sugestao_reescrita: string;
}

export interface CompetenciaFeedback {
  competencia_1?: string;
  competencia_2?: string;
  competencia_3?: string;
  competencia_4?: string;
  competencia_5?: string;
  _meta?: {
    tipo_textual?: string;
    fuga_tipo_textual?: boolean;
    aderencia_tema?: "dentro" | "tangencia" | "fuga_total";
    aderencia_justificativa?: string;
  };
  _paragrafos?: {
    introducao?: ParagrafoAnalise;
    desenvolvimento_1?: ParagrafoAnalise;
    desenvolvimento_2?: ParagrafoAnalise;
    conclusao?: ParagrafoAnalise;
  };
}

export const COMPETENCIAS = [
  { key: "competencia_1", num: 1, title: "Norma culta", description: "Domínio da escrita formal da língua portuguesa" },
  { key: "competencia_2", num: 2, title: "Compreensão do tema", description: "Aplicar conceitos de várias áreas para desenvolver o tema" },
  { key: "competencia_3", num: 3, title: "Argumentação", description: "Selecionar e organizar informações em defesa de um ponto de vista" },
  { key: "competencia_4", num: 4, title: "Coesão", description: "Mecanismos linguísticos para construção da argumentação" },
  { key: "competencia_5", num: 5, title: "Proposta de intervenção", description: "Proposta detalhada respeitando os direitos humanos" },
] as const;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countLines(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // ENEM: folha oficial tem ~73 caracteres úteis por linha (fonte + margens reais).
  const CHARS_PER_LINE = 73;
  const paragraphs = trimmed.split(/\n+/);
  let lines = 0;
  for (const p of paragraphs) {
    const len = p.trim().length;
    lines += len === 0 ? 1 : Math.ceil(len / CHARS_PER_LINE);
  }
  return Math.max(1, lines);
}

export async function listEssays(): Promise<Essay[]> {
  const { data, error } = await supabase
    .from("essays")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEssay(id: string): Promise<Essay | null> {
  const { data, error } = await supabase.from("essays").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createEssay(userId: string, tema = ""): Promise<Essay> {
  const { data, error } = await supabase
    .from("essays")
    .insert({ user_id: userId, tema, texto: "", status: "rascunho" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEssayDraft(id: string, fields: { tema?: string; texto?: string }): Promise<void> {
  const update: { tema?: string; texto?: string; word_count?: number; line_count?: number } = { ...fields };
  if (typeof fields.texto === "string") {
    update.word_count = countWords(fields.texto);
    update.line_count = countLines(fields.texto);
  }
  const { error } = await supabase.from("essays").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteEssay(id: string): Promise<void> {
  const { error } = await supabase.from("essays").delete().eq("id", id);
  if (error) throw error;
}

export async function suggestEssayTheme(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("essay-corrector", {
    body: { action: "suggest_theme" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data?.tema as string;
}

export async function correctEssay(essayId: string, tema: string, texto: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("essay-corrector", {
    body: { action: "correct", essayId, tema, texto },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
