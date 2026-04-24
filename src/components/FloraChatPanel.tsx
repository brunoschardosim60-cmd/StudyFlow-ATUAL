import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, X, ThumbsUp, ThumbsDown, RotateCcw, Sparkles, MessageCircle } from "lucide-react";
import { FloraQuotaIndicator } from "@/components/FloraQuotaIndicator";
import { FloraIcon } from "@/components/FloraIcon";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative';
  actions?: FloraAction[];
}

interface FloraAction {
  type: string;
  payload: Record<string, unknown>;
}

interface FloraChat {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
}

type Objetivo = "enem" | "vestibular" | "concurso" | "faculdade" | "aprender" | string;

// Chips de sugestão adaptados ao objetivo do aluno e contexto
function getSuggestionChips(objetivo: Objetivo, messageCount: number): string[] {
  const baseSuggestions = ["Me ajuda a estudar", "Monta um cronograma", "Quero um quiz"];

  if (messageCount === 0) {
    // Primeira interação
    return ["Olá! Me apresenta?", "Como você pode me ajudar?", "Quero saber meu progresso"];
  }

  switch (objetivo) {
    case "enem":
    case "vestibular":
      return messageCount > 5
        ? ["Revisar matérias difíceis", "Simular prova", "Dicas para redação", "Análise de desempenho"]
        : ["Me ajuda a estudar", "Monta um cronograma", "Quero um quiz ENEM", "Simular questão ENEM"];
    case "concurso":
      return messageCount > 5
        ? ["Questões específicas", "Técnicas de estudo", "Análise de edital", "Simulação de prova"]
        : ["Me ajuda a estudar", "Monta um cronograma", "Quiz de conhecimentos gerais", "Simular questão"];
    case "faculdade":
      return messageCount > 5
        ? ["Explicar conceitos", "Resumos de aula", "Preparação para prova", "Dicas de estudo"]
        : ["Me ajuda a estudar", "Monta um cronograma", "Quero um quiz", "Explica um conceito"];
    default:
      return messageCount > 5
        ? ["Revisar conteúdo", "Praticar exercícios", "Explicar dúvidas", "Criar flashcards"]
        : ["Me ajuda a estudar", "Monta um cronograma", "Quero um quiz rápido", "Explica um conceito"];
  }
}

/* ── Balanced-brace JSON extractor ── */
function extractBalancedJSON(text: string, startIdx: number): { json: string; endIdx: number } | null {
  if (text[startIdx] !== "{") return null;
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return { json: text.slice(startIdx, i + 1), endIdx: i + 1 }; }
  }
  return null;
}

function parseFloraActions(text: string): { cleanText: string; actions: FloraAction[] } {
  const actions: FloraAction[] = [];
  let cleanText = text;
  const actionTokenRegex = /\[AÇÃO:(CRONOGRAMA|REMOVER_CRONOGRAMA|QUIZ|FLASHCARDS|POMODORO|CADERNO|META_DIA)\]\s*/g;
  let match;
  const removals: { start: number; end: number }[] = [];
  while ((match = actionTokenRegex.exec(text)) !== null) {
    const afterToken = match.index + match[0].length;
    const braceStart = text.indexOf("{", afterToken - 1);
    if (braceStart !== -1 && braceStart <= afterToken + 2) {
      const extracted = extractBalancedJSON(text, braceStart);
      if (extracted) {
        try {
          const payload = JSON.parse(extracted.json);
          actions.push({ type: match[1], payload });
          removals.push({ start: match.index, end: extracted.endIdx });
        } catch { /* malformed */ }
      } else {
        removals.push({ start: match.index, end: text.length });
      }
    }
  }
  for (let i = removals.length - 1; i >= 0; i--) {
    cleanText = cleanText.slice(0, removals[i].start) + cleanText.slice(removals[i].end);
  }
  cleanText = cleanText
    .replace(/[,\s]*\{["'\s]*(dia|dayOfWeek|horario|startTime|materia|subject|workMin|slots|frente|verso|pergunta|alternativas)["'\s]*\s*:[\s\S]*?\}(\s*\})?/g, "")
    .replace(/\[\s*\{["'\s]*(dia|dayOfWeek|horario|startTime|materia|subject|frente|pergunta)[\s\S]*?\]\s*/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[\]\}]+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanText, actions };
}

function sanitizeHistory(messages: Message[]): Message[] {
  return messages.map(m => {
    if (m.role !== "assistant") return m;
    const { cleanText } = parseFloraActions(m.content);
    return { ...m, content: cleanText };
  });
}

export function FloraChatPanel({ isOpen, onClose, initialMessage }: FloraChat) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [objetivo, setObjetivo] = useState<Objetivo>("enem");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flora-engine`;

  // Carrega objetivo do onboarding
  useEffect(() => {
    if (!user) return;
    supabase
      .from("student_onboarding")
      .select("objetivo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.objetivo) setObjetivo(data.objetivo as Objetivo);
      });
  }, [user]);

  useEffect(() => {
    if (isOpen && initialMessage) {
      setInput(initialMessage);
      inputRef.current?.focus();
    }
  }, [isOpen, initialMessage]);

  // Carrega histórico do chat
  useEffect(() => {
    if (!isOpen || chatLoaded || !user) return;
    loadChatHistory();
  }, [isOpen, chatLoaded, user]);

  const loadChatHistory = async () => {
    try {
      const { data } = await supabase.functions.invoke("flora-engine", {
        body: { action: "load_chat" },
      });
      if (data?.messages?.length) {
        const loaded: Message[] = data.messages.map((m: any, index: number) => ({
          id: m.id || `msg-${index}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at || Date.now()),
          feedback: m.feedback,
          actions: m.actions
        }));

        setMessages(loaded);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
    setChatLoaded(true);
  };

  // Scroll automático
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setIsTyping(true);
    setShowSuggestions(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("No access token");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: "chat",
          data: {
            message: messageText,
            history: sanitizeHistory(messages.slice(-10)),
          },
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const { cleanText, actions } = parseFloraActions(data.response || "Desculpe, houve um erro.");

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: cleanText,
        timestamp: new Date(),
        actions
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Executar ações automaticamente
      if (actions.length > 0) {
        await executeActions(actions);
      }

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Desculpe, houve um erro na comunicação. Tente novamente em alguns instantes.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  };

  const executeActions = async (actions: FloraAction[]) => {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "CRONOGRAMA":
            toast.success("Cronograma criado com sucesso!");
            navigate("/dashboard");
            break;
          case "QUIZ":
            toast.success("Quiz gerado! Verifique suas notificações.");
            break;
          case "FLASHCARDS":
            toast.success("Flashcards criados!");
            break;
          case "POMODORO":
            toast.success("Temporizador Pomodoro iniciado!");
            break;
          default:
            console.log("Ação executada:", action.type);
        }
      } catch (error) {
        console.error('Erro ao executar ação:', error);
      }
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ));

    // Salvar feedback no backend
    try {
      await supabase.functions.invoke("flora-engine", {
        body: {
          action: "feedback",
          data: { messageId, feedback }
        },
      });
    } catch (error) {
      console.error('Erro ao salvar feedback:', error);
    }
  };

  const clearChat = async () => {
    if (!confirm("Tem certeza que deseja limpar o histórico do chat?")) return;

    try {
      await supabase.functions.invoke("flora-engine", {
        body: { action: "clear_chat" },
      });
      setMessages([]);
      toast.success("Histórico limpo com sucesso!");
    } catch (error) {
      toast.error("Erro ao limpar histórico.");
    }
  };

  const suggestionChips = getSuggestionChips(objetivo, messages.length);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="relative">
                <FloraIcon className="w-8 h-8" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Flora</h3>
                <p className="text-xs text-muted-foreground">Sua assistente de estudos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FloraQuotaIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-8 w-8"
                title="Limpar chat"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
          >
            {messages.length === 0 && !isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8"
              >
                <FloraIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h4 className="font-medium mb-2">Olá! Como posso te ajudar hoje?</h4>
                <p className="text-sm text-muted-foreground">
                  Estou aqui para criar cronogramas, gerar quizzes, explicar conceitos e muito mais!
                </p>
              </motion.div>
            )}

            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-12'
                        : 'bg-muted mr-12'
                    }`}
                  >
                    <ReactMarkdown className="text-sm prose prose-sm max-w-none dark:prose-invert">
                      {message.content}
                    </ReactMarkdown>

                    {message.role === 'assistant' && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleFeedback(message.id, 'positive')}
                          >
                            <ThumbsUp className={`w-3 h-3 ${message.feedback === 'positive' ? 'text-green-500' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleFeedback(message.id, 'negative')}
                          >
                            <ThumbsDown className={`w-3 h-3 ${message.feedback === 'negative' ? 'text-red-500' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl px-4 py-3 mr-12">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Flora está digitando...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Suggestions */}
          {showSuggestions && messages.length < 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 pb-2"
            >
              <div className="flex flex-wrap gap-2">
                {suggestionChips.slice(0, 4).map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(suggestion)}
                    disabled={isSending}
                    className="text-xs h-8"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {suggestion}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Digite sua mensagem..."
                disabled={isSending}
                className="flex-1"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isSending}
                size="icon"
                className="shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

        if (!resp.ok || !resp.body || cancelled) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { buffer = ""; break; }
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                content += delta;
                const { cleanText } = parseFloraActions(content);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && prev.length === messages.length + 1) {
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
                  }
                  return [...prev, { role: "assistant", content: cleanText }];
                });
              }
            } catch { /* skip */ }
          }
        }

        if (content && !cancelled) {
          const { cleanText } = parseFloraActions(content);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
            }
            return [...prev, { role: "assistant", content: cleanText }];
          });
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setIsDailySummaryLoading(false); }
    })();

    return () => { cancelled = true; setIsDailySummaryLoading(false); };
  }, [isOpen, chatLoaded, user, CHAT_URL, messages]);

  // Salva histórico com debounce
  useEffect(() => {
    if (!user || messages.length === 0 || !chatLoaded) return;
    const timer = setTimeout(() => {
      supabase.functions.invoke("flora-engine", {
        body: {
          action: "save_chat",
          data: { messages: messages.slice(-100).map((m) => ({ role: m.role, content: m.content })) },
        },
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [messages, user, chatLoaded]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const executeAction = useCallback(async (action: FloraAction) => {
    try {
      const { data, error } = await supabase.functions.invoke("flora-engine", {
        body: { action: "execute_action", data: { actionType: action.type, payload: action.payload } },
      });
      if (error) throw error;
      if (data?.type === "quiz" && data.questions?.length) {
        window.dispatchEvent(new CustomEvent("flora-quiz", { detail: data }));
        toast.success(`Quiz gerado com ${data.questions.length} questões.`);
      } else if (data?.type === "flashcards" && data.flashcards?.length) {
        window.dispatchEvent(new CustomEvent("flora-flashcards", { detail: data }));
        toast.success(`${data.flashcards.length} flashcards criados.`);
      } else if (data?.type === "pomodoro") {
        window.dispatchEvent(new CustomEvent("flora-pomodoro", { detail: data }));
        toast.success("Pomodoro configurado.");
      } else if (action.type === "CRONOGRAMA") {
        window.dispatchEvent(new CustomEvent("flora-schedule-updated", { detail: action.payload }));
        toast.success("Cronograma salvo.");
      } else if (action.type === "REMOVER_CRONOGRAMA") {
        window.dispatchEvent(new CustomEvent("flora-schedule-removed", { detail: data }));
        toast.success("Matéria removida do cronograma.");
      } else if (data?.type === "notebook" && data.notebookId) {
        toast.success(`Caderno "${data.titulo || "Novo"}" criado.`);
        navigate(`/notebooks/${data.notebookId}`);
        onClose();
      } else if (data?.type === "meta_dia") {
        window.dispatchEvent(new CustomEvent("flora-meta-dia", { detail: data }));
        toast.success("Meta do dia atualizada!");
      }
    } catch (err) {
      console.error("Action error:", err);
      toast.error("Erro ao executar ação.");
    }
  }, [navigate, onClose]);

  const send = async () => {
    if (!input.trim() || isSending) return;
    const messageToSend = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setInput("");
    setIsSending(true);
    let assistantContent = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: "recommend",
          data: { message: messageToSend, history: sanitizeHistory(messages.slice(-30)) },
        }),
      });

      if (!resp.ok) {
        // Erros com mensagem amigável
        if (resp.status === 429) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j?.message || "Limite diário de chamadas IA atingido. Tente amanhã ou faça upgrade.");
        }
        if (resp.status === 503) throw new Error("A Flora está sobrecarregada agora. Tenta em instantes.");
        if (resp.status === 401) throw new Error("Sessão expirada. Recarregue a página.");
        throw new Error(`Erro ${resp.status}. Tenta de novo.`);
      }

      if (!resp.body) {
        const j = await resp.json();
        assistantContent = j?.choices?.[0]?.message?.content || j?.content || JSON.stringify(j);
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { buffer = ""; break; }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                assistantContent += delta;
                const { cleanText } = parseFloraActions(assistantContent);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
                  }
                  return [...prev, { role: "assistant", content: cleanText }];
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      if (assistantContent) {
        const { cleanText, actions } = parseFloraActions(assistantContent);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
          }
          return [...prev, { role: "assistant", content: cleanText }];
        });
        for (const action of actions) executeAction(action);
      }

      if (!assistantContent) {
        setMessages((prev) => {
          if (prev[prev.length - 1]?.role !== "assistant") {
            return [...prev, { role: "assistant", content: "Não consegui responder agora. Tenta de novo?" }];
          }
          return prev;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tive um problema. Tenta de novo?";
      console.error("Flora chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const chips = getSuggestionChips(objetivo);

  return (
    <div className="fixed bottom-0 right-0 w-full h-[80vh] sm:bottom-20 sm:right-4 sm:w-[380px] sm:h-[500px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-6rem)] z-50 sm:rounded-2xl rounded-t-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-primary/5">
        <FloraIcon className="w-6 h-6 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm">Flora</p>
          <p className="text-xs text-muted-foreground">Sua professora parceira</p>
        </div>
        <FloraQuotaIndicator action="chat" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3 px-2">
            <FloraIcon className="w-10 h-10 text-primary mx-auto" />
            <div className="text-sm text-foreground space-y-2 text-left bg-muted rounded-xl px-3 py-3 mr-8">
              <p className="font-semibold">Oi! Eu sou a Flora, sua professora parceira.</p>
              <p>Estou aqui pra te ajudar de verdade. Posso:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Montar seu cronograma semanal</li>
                <li>Criar quizzes e flashcards</li>
                <li>Escrever redações e provas</li>
                <li>Tirar dúvidas de qualquer matéria</li>
                <li>Organizar suas revisões</li>
              </ul>
              <p>Me diz: por onde quer começar?</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {chips.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            <div className={`rounded-xl px-3 py-2 text-sm overflow-hidden break-words ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-muted mr-8"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [overflow-wrap:anywhere]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isSending && messages[messages.length - 1]?.role === "user" && (
          <div className="bg-muted rounded-xl px-3 py-3 mr-8 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <FloraIcon className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Flora pensando</span>
              <span className="flex gap-0.5 ml-0.5">
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={isSending ? "Flora pensando..." : "Fala comigo..."}
            className="flex-1 text-sm resize-none rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-100"
            disabled={isSending}
            rows={1}
            style={{ minHeight: "38px", maxHeight: "120px" }}
          />
          <Button type="submit" size="icon" className="shrink-0" disabled={!input.trim() || isSending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
