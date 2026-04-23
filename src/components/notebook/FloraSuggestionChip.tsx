import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Trigger {
  /** Palavras-chave que disparam a sugestão (lowercase, sem acento). */
  keywords: string[];
  /** Texto curto exibido no chip. */
  label: string;
  /** Pergunta pré-formada enviada à Flora. */
  question: string;
}

const TRIGGERS: Trigger[] = [
  {
    keywords: ["integral", "integrais", "primitiva"],
    label: "Explicar integral",
    question: "Me explique o conceito de integral e como aplicar o método de substituição com um exemplo passo a passo.",
  },
  {
    keywords: ["derivada", "derivar"],
    label: "Explicar derivada",
    question: "Me explique o conceito de derivada e as regras principais (potência, produto, cadeia) com exemplos.",
  },
  {
    keywords: ["fracao", "fração", "fracoes", "frações"],
    label: "Revisar frações",
    question: "Faça uma revisão rápida sobre operações com frações (soma, subtração, multiplicação e divisão) com exemplos.",
  },
  {
    keywords: ["forca", "força", "newton", "atrito"],
    label: "Diagrama de forças",
    question: "Explique como montar um diagrama de corpo livre e aplicar as três leis de Newton em problemas típicos do ENEM.",
  },
  {
    keywords: ["estequiometria", "mol", "balanceamento"],
    label: "Estequiometria",
    question: "Me explique estequiometria passo a passo e como o ENEM costuma cobrar esse conteúdo.",
  },
  {
    keywords: ["funcao quadratica", "função quadrática", "parabola", "parábola", "delta", "bhaskara"],
    label: "Função quadrática",
    question: "Me explique funções quadráticas: vértice, raízes e como interpretar gráficos no ENEM.",
  },
];

interface FloraSuggestionChipProps {
  /** Texto observado (conteúdo da página, anotação atual). */
  text: string;
}

/**
 * Chip flutuante discreto, estilo Atlas:
 * - aparece SOMENTE quando detecta termo-chave no texto
 * - mostra UMA sugestão por contexto (não repete o mesmo trigger)
 * - usuário descarta com X ou clica em "explicar" → abre Flora no Dashboard com pergunta pré-pronta
 */
export function FloraSuggestionChip({ text }: FloraSuggestionChipProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);
  const lastShownRef = useRef<string | null>(null);

  const normalized = useMemo(
    () =>
      (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    [text],
  );

  const activeTrigger = useMemo(() => {
    if (!normalized) return null;
    return (
      TRIGGERS.find((t) =>
        t.keywords.some((k) => normalized.includes(k)),
      ) ?? null
    );
  }, [normalized]);

  // Reaparece se aparecer novo trigger
  useEffect(() => {
    if (activeTrigger && lastShownRef.current !== activeTrigger.label) {
      lastShownRef.current = activeTrigger.label;
      if (!dismissed.has(activeTrigger.label)) setVisible(true);
    }
  }, [activeTrigger, dismissed]);

  if (!activeTrigger || !visible || dismissed.has(activeTrigger.label)) return null;

  const handleAsk = () => {
    sessionStorage.setItem("flora.suggestedQuestion", activeTrigger.question);
    navigate("/?flora=1");
  };

  const handleDismiss = () => {
    const next = new Set(dismissed);
    next.add(activeTrigger.label);
    setDismissed(next);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 animate-fade-in">
      <div className="flex items-center gap-1 rounded-full bg-background/95 border border-border shadow-lg backdrop-blur-sm pl-3 pr-1 py-1">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <button
          type="button"
          onClick={handleAsk}
          className="text-xs font-medium text-foreground hover:text-primary transition-colors px-1"
        >
          {activeTrigger.label}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-full text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Descartar sugestão"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
