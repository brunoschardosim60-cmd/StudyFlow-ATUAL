import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  type Msg,
  type CallOptions,
  type TaskType,
  callGemini,
  callWithTaskFallback,
  runChain,
  parseAIJSON,
  trimHistory,
  TOKEN_LIMITS,
} from "../_shared/providers.ts";
import { checkQuota, logAIUsage, quotaExceededResponse } from "../_shared/usage.ts";

// Mapeia ações públicas → action_type usado pra quota.
// "chat" cobre `recommend` (chat com a Flora).
const QUOTA_ACTION_MAP: Record<string, string> = {
  recommend: "chat",
  decide_next_topic: "decide_next_topic",
  study_now: "decide_next_topic",
  generate_quiz: "generate_quiz",
  generate_flashcards: "generate_flashcards",
  generate_initial_plan: "decide_next_topic",
};

// Constrói bloco de ADAPTAÇÃO REAL pra incluir no system prompt do Flora.
// A IA deve USAR esses sinais pra decidir comportamento (não só listar).
function buildAdaptiveBlock(context: {
  performance: any[];
  recentSessions: any[];
  pendingReviews: any[];
  onboarding: any;
}): string {
  const perf = context.performance ?? [];
  const sessions = context.recentSessions ?? [];
  const reviews = context.pendingReviews ?? [];
  const onb = context.onboarding;

  // Erros recorrentes (>=3 erros ou accuracy<60)
  const fracos = perf
    .filter((p: any) => p.erro_recorrente || p.accuracy < 60)
    .sort((a: any, b: any) => (b.prioridade ?? 0) - (a.prioridade ?? 0))
    .slice(0, 5);

  // Domínio (accuracy>=80)
  const fortes = perf.filter((p: any) => p.accuracy >= 80).slice(0, 5);

  // Última sessão — detecta sumiço
  const ultimaSessao = sessions[0]?.start_at ? new Date(sessions[0].start_at) : null;
  const diasSemEstudar = ultimaSessao
    ? Math.floor((Date.now() - ultimaSessao.getTime()) / (1000 * 60 * 60 * 24))
    : 99;

  // Revisões atrasadas
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const atrasadas = reviews.filter((r: any) => new Date(r.scheduled_date) < hoje).length;

  // Matérias difíceis declaradas no onboarding
  const dificeisOnb: string[] = onb?.materias_dificeis ?? [];

  // Decisão sugerida (a IA deve seguir):
  const decisoes: string[] = [];
  if (diasSemEstudar >= 3) decisoes.push(`SUMIU ${diasSemEstudar} dias → reduza carga, sugira 1 ação curta e motive sem cobrar`);
  if (atrasadas >= 5) decisoes.push(`${atrasadas} revisões atrasadas → priorize REVISÃO antes de conteúdo novo`);
  if (fracos.length > 0) decisoes.push(`PRIORIZAR estes erros recorrentes: ${fracos.map((f: any) => `${f.materia} (${f.accuracy}%)`).join(", ")}`);
  if (fortes.length > 0 && fracos.length === 0) decisoes.push(`Aluno dominando: ${fortes.map((f: any) => f.materia).join(", ")} → SOBE dificuldade dos quizzes pra "dificil"`);
  if (dificeisOnb.length > 0) decisoes.push(`Matérias declaradas difíceis no onboarding: ${dificeisOnb.join(", ")} → dê atenção extra`);

  return `
ADAPTAÇÃO REAL (use ATIVAMENTE pra decidir comportamento, não só citar):
${decisoes.length > 0 ? decisoes.map(d => `- ${d}`).join("\n") : "- Sem sinais fortes ainda → mantenha curso normal"}

QUANDO ABRIR O CARD "POR QUE DECIDI ISSO": ao sugerir um quiz/tópico/foco específico, inclua na resposta uma frase tipo "Notei que você ${fracos[0] ? `errou bastante em ${fracos[0].materia}` : diasSemEstudar >= 3 ? `ficou ${diasSemEstudar} dias sem estudar` : `está mandando bem`}, então vamos ${fracos[0] ? `focar nisso` : `continuar firme`}." — natural, sem parecer técnica.`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────
type Objetivo = "enem" | "vestibular" | "concurso" | "faculdade" | "aprender" | string;

// Re-usa buildChain via callWithTaskFallback do shared
// Wrapper local para compatibilidade com o código existente.
// Loga uso (estimativa de tokens) — fire-and-forget.
async function runTaskChain(opts: CallOptions, task: TaskType, tag: string, ctx?: { supabase: any; userId: string; actionType: string }): Promise<string> {
  const t0 = Date.now();
  try {
    const out = await callWithTaskFallback(opts, task, tag);
    if (ctx) {
      // Estimativa simples: 1 token ≈ 4 chars (PT/EN).
      const tokensIn = Math.round(JSON.stringify(opts.messages ?? []).length / 4);
      const tokensOut = Math.round((out?.length ?? 0) / 4);
      logAIUsage(ctx.supabase, {
        userId: ctx.userId,
        actionType: ctx.actionType,
        model: task,
        tokensIn,
        tokensOut,
        success: true,
        metadata: { tag, latencyMs: Date.now() - t0 },
      });
    }
    return out;
  } catch (e) {
    if (ctx) {
      logAIUsage(ctx.supabase, {
        userId: ctx.userId,
        actionType: ctx.actionType,
        model: task,
        success: false,
        errorMessage: e instanceof Error ? e.message : String(e),
        metadata: { tag, latencyMs: Date.now() - t0 },
      });
    }
    throw e;
  }
}


// ─── Objetivo do onboarding ───────────────────────────────────────────────────
function getObjetivoContext(objetivo: Objetivo) {
  switch (objetivo) {
    case "enem": case "vestibular":
      return { label: "ENEM", quizStyle: "5 alternativas (A-E), contexto inicial obrigatório, padrão INEP", nivelDesc: "Ensino Médio / ENEM" };
    case "concurso":
      return { label: "Concurso público", quizStyle: "4 alternativas (A-D), estilo CESPE/FCC", nivelDesc: "Concurso público" };
    case "faculdade": case "aprender": default:
      return { label: "Aprendizado geral", quizStyle: "5 alternativas, nível médio adaptado", nivelDesc: "Ensino Médio" };
  }
}

// Detecta se um tema envolve matérias exatas (usa DeepSeek como primário)
function isExatasTask(materia: string): boolean {
  const exatas = ["matemática", "matematica", "física", "fisica", "química", "quimica", "biologia"];
  return exatas.some(e => materia.toLowerCase().includes(e));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, data } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Unauthorized: invalid token" }, 401);
    const userId = user.id;

    // ─── QUOTA GUARD ──────────────────────────────────────────────────────
    // Bloqueia ações IA pagas se o usuário estourou o limite diário do tier.
    // Ações leves (log_action, save_chat, load_chat, execute_action sem IA) passam.
    const quotaActionType = QUOTA_ACTION_MAP[action];
    if (quotaActionType) {
      const quota = await checkQuota(supabase, userId, quotaActionType);
      if (!quota.allowed) {
        console.warn(`[flora] quota exceeded user=${userId} action=${action} tier=${quota.tier} ${quota.used}/${quota.limit}`);
        return quotaExceededResponse(quota, corsHeaders);
      }
    }
    // execute_action tem subtipos (QUIZ, FLASHCARDS) que também consomem IA — checa lá embaixo.

    // ─── Context do aluno ──────────────────────────────────────────────────
    async function getStudentContext(uid: string) {
      const [
        { data: onboarding }, { data: performance }, { data: recentActions },
        { data: recentDecisions }, { data: pendingReviews }, { data: profile },
        { data: studyState }, { data: weeklySlots }, { data: recentSessions }, { data: recentChat },
      ] = await Promise.all([
        supabase.from("student_onboarding").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("student_performance").select("*").eq("user_id", uid).order("prioridade", { ascending: false }).limit(20),
        supabase.from("user_actions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(15),
        supabase.from("flora_decisions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("spaced_reviews").select("*").eq("user_id", uid).eq("completed", false).order("scheduled_date").limit(20),
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("study_state").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("weekly_slots").select("*").eq("user_id", uid).order("dia").limit(50),
        supabase.from("study_sessions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
        supabase.from("flora_chat_messages").select("role,content").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      ]);
      return { onboarding, performance: performance ?? [], recentActions: recentActions ?? [], recentDecisions: recentDecisions ?? [], pendingReviews: pendingReviews ?? [], profile, studyState, weeklySlots: weeklySlots ?? [], recentSessions: recentSessions ?? [], recentChat: (recentChat ?? []).reverse() };
    }

    // ─── Streaming do chat ─────────────────────────────────────────────────
    // Streaming: Gemini k1 (SSE) → Gemini k2 (SSE) → Lovable → síntese non-stream
    async function callAIStream(messages: Msg[]): Promise<Response> {
      const k1 = Deno.env.get("GEMINI_API_KEY") ?? "";
      const k2 = Deno.env.get("GEMINI_API_KEY_2") ?? "";

      async function tryGeminiStream(apiKey: string, label: string): Promise<Response | null> {
        if (!apiKey) return null;
        try {
          const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
          const userMsgs = messages.filter(m => m.role !== "system");
          const contents = userMsgs.length
            ? userMsgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))
            : [{ role: "user", parts: [{ text: "Olá" }] }];
          const body: Record<string, unknown> = { contents, generationConfig: { temperature: 0.55, maxOutputTokens: 4096 } };
          if (sys) body.systemInstruction = { parts: [{ text: sys }] };

          const geminiStream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          );
          if (!geminiStream.ok || !geminiStream.body) { console.warn(`[flora:stream] ${label} falhou ${geminiStream.status}`); return null; }

          // Converte SSE Gemini → SSE OpenAI (formato que o frontend espera)
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();
          const reader = geminiStream.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf("\n")) !== -1) {
                  const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
                  if (!line.startsWith("data:")) continue;
                  const jsonStr = line.slice(5).trim(); if (jsonStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}

`));
                  } catch { /* skip */ }
                }
              }
              await writer.write(encoder.encode("data: [DONE]\n\n"));
            } catch (e) { console.warn(`[flora:stream] ${label} stream error:`, e); }
            finally { await writer.close(); }
          })();
          console.log(`[flora:stream] ${label} OK`);
          return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        } catch (e) { console.warn(`[flora:stream] ${label} exception:`, e); return null; }
      }

      // Tenta Gemini k1, depois k2, depois Lovable
      const r1 = await tryGeminiStream(k1, "gemini");
      if (r1) return r1;
      const r2 = await tryGeminiStream(k2, "gemini_2");
      if (r2) return r2;

      // Lovable stream
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST", headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, stream: true }),
          });
          if (resp.ok && resp.body) { console.log("[flora:stream] lovable OK"); return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }); }
        } catch (e) { console.warn("[flora:stream] lovable exception:", e); }
      }

      // Síntese SSE a partir de non-stream (fallback final)
      const opts: CallOptions = { messages, maxTokens: 1500, temperature: 0.55 };
      const full = await runTaskChain(opts, "chat", "flora:chat-synth", { supabase, userId, actionType: "chat" });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const chunks = full.match(/[\s\S]{1,40}/g) || [full];
          for (const piece of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}

`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ─── System prompt da Flora ────────────────────────────────────────────
    function buildSystemPrompt(context: Awaited<ReturnType<typeof getStudentContext>>) {
      const nome = context.profile?.display_name || "aluno";
      const isAdmin = context.profile?.is_admin === true;
      const hasData = context.performance.length > 0 || context.recentActions.length > 0;
      const totalStudyMin = Math.round(context.recentSessions.reduce((a: number, s: any) => a + (s.duration_ms || 0), 0) / 60000);
      const weakSubjects = context.performance.filter((p: any) => p.accuracy < 60 || p.erro_recorrente).map((p: any) => `${p.materia} (${p.accuracy}% acerto)`).slice(0, 5);
      const overdueReviews = context.pendingReviews.filter((r: any) => new Date(r.scheduled_date) < new Date()).length;
      const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
      const objCtx = getObjetivoContext(objetivo);

      const adminInfo = isAdmin ? `
ESSE USUÁRIO É ADMINISTRADOR. Trate-o como admin/criador da plataforma.` : "";
      const onboardingInfo = context.onboarding
        ? `
ONBOARDING (use pra personalizar, NUNCA mencione):
- Objetivo: ${objCtx.label}
- Tempo: ${context.onboarding.tempo_disponivel_min} min/dia
- Difíceis: ${(context.onboarding.materias_dificeis || []).join(", ") || "nenhuma"}
- Rotina: ${context.onboarding.rotina}
- Meta: ${context.onboarding.meta_resultado}`
        : "";

      const allChat = context.recentChat;
      const olderMsgs = allChat.slice(0, Math.max(0, allChat.length - 25));
      const recentMsgs = allChat.slice(-25);
      const olderSummary = olderMsgs.length > 0 ? `
CONVERSA ANTERIOR (${olderMsgs.length} msgs):
${olderMsgs.map((m: any) => `${m.role === "user" ? "Aluno" : "Flora"}: ${m.content.slice(0, 90).replace(/\n/g, " ")}`).join(" | ")}` : "";
      const recentChatSummary = recentMsgs.length > 0 ? `
ÚLTIMAS MENSAGENS:
${recentMsgs.map((m: any) => `${m.role === "user" ? "Aluno" : "Flora"}: ${m.content.slice(0, 250)}`).join("\n")}` : "";

      return `Você é Flora, professora-parceira do StudyFlow — especialista em ${objCtx.label} e ${objCtx.nivelDesc}.${adminInfo}

OBJETIVO DO ALUNO: ${objCtx.label} | ESTILO DE QUIZ: ${objCtx.quizStyle}

REGRAS ABSOLUTAS: 1) NUNCA exiba JSON ou dados técnicos. 2) NUNCA diga que salvou algo. 3) Chat curto (5 linhas) — conteúdo longo SEMPRE vai pra ação ([AÇÃO:CADERNO] ou [AÇÃO:QUIZ]), nunca inline. 4) Sem emoji. 5) Os blocos [AÇÃO:...] ficam escondidos no final.

COMO FALAR: Direta, prática, linguagem natural tipo "Boa. Vamos focar em X." Nunca "analisando dados" ou "com base nos seus dados". Sempre termine com pergunta curta ou próxima ação.

REGRA DE OURO — ONDE O CONTEÚDO VAI:
- QUIZ / TESTE / SIMULADO / PROVA → SEMPRE [AÇÃO:QUIZ] (NUNCA escreva as questões no chat)
- RESUMO / EXPLICAÇÃO LONGA / TEORIA → SEMPRE [AÇÃO:CADERNO] (NUNCA escreva o resumo no chat)
- REDAÇÃO COMPLETA → SEMPRE [AÇÃO:CADERNO] com a redação inteira no campo "conteudo"
- FLASHCARDS → SEMPRE [AÇÃO:FLASHCARDS]
No chat você só dá uma frase tipo "Pronto, abri o quiz pra você." ou "Resumo no caderno X." — o conteúdo aparece fora do chat automaticamente.

REGRA UNIVERSAL DE QUALIDADE (vale para TUDO que você gerar — quiz, prova, simulado, flashcard, exercício, questão de revisão):
- UNICIDADE: APENAS UMA resposta correta. Nunca duas alternativas defensáveis.
- SEM AMBIGUIDADE: enunciados claros, sem duplo sentido, sem termos vagos ("o melhor", "o mais adequado") sem critério objetivo.
- JUSTIFICÁVEL: a correta deve ser sustentada por regra, lei, definição ou dado verificável; cada distrator deve ter erro factual/lógico apontável.
- Antes de finalizar, RELEIA e confirme: "só uma está certa, e consigo provar por quê".

QUANDO EXPLICAR UM CONCEITO RÁPIDO (até 5 linhas, dúvida pontual): responda inline.
QUANDO O ALUNO PEDE EXPLICAÇÃO COMPLETA / RESUMO / MATERIAL DE ESTUDO: SEMPRE use [AÇÃO:CADERNO] — proibido escrever inline.

FLUXO DE AÇÃO: Toda ação = 2 mensagens do aluno. 1ª: sugerir + perguntar curto. 2ª (confirmação): incluir [AÇÃO:...] + frase curta confirmando.
NUNCA inclua [AÇÃO:...] na mesma resposta que pergunta. NUNCA gere ação sem confirmação clara (sim/ok/pode/manda/bora/faz).

CORREÇÃO DE REDAÇÕES (do aluno): ${objetivo === "enem" || objetivo === "vestibular"
  ? "5 competências ENEM (C1-C5, 0-200 cada). Para cada: bom + ruim + trecho + sugestão de reescrita. Use [AÇÃO:CADERNO] com tudo formatado em HTML."
  : "Clareza, argumentação, norma culta, estrutura. Nota 0-10. Use [AÇÃO:CADERNO]."}

AÇÕES (no FINAL, APÓS CONFIRMAÇÃO):
[AÇÃO:CRONOGRAMA]{"slots":[{"dia":0,"horario":"14:00","materia":"Matemática","descricao":"..."}]}
[AÇÃO:QUIZ]{"materia":"...","tema":"...","difficulty":"medio"}    ← usa para quiz/teste/simulado/prova
[AÇÃO:FLASHCARDS]{"materia":"...","tema":"..."}
[AÇÃO:POMODORO]{"workMin":25,"restMin":5}
[AÇÃO:CADERNO]{"titulo":"...","materia":"...","conteudo":"<h2>...</h2><p>...</p>"}    ← usa para resumo/explicação longa/redação completa/correção de redação
[AÇÃO:META_DIA]{"studyMinutes":60,"revisions":5,"quizCount":2}
[AÇÃO:REMOVER_CRONOGRAMA]{"materia":"..."}

EXEMPLOS DO COMPORTAMENTO CERTO:
Aluno: "me faz um resumo de mitose" → "Boa. Resumo completo no caderno?"
Aluno: "sim" → "Pronto, ta no caderno Biologia." [AÇÃO:CADERNO]{"titulo":"Mitose","materia":"Biologia","conteudo":"<h2>Mitose</h2><p>...</p>..."}
Aluno: "quiz de funções" → "Quantas questões? 10 padrão?"
Aluno: "manda" → "Abrindo." [AÇÃO:QUIZ]{"materia":"Matemática","tema":"Funções","difficulty":"medio"}

O nome do aluno é ${nome}. Responda SEMPRE em português brasileiro.
${onboardingInfo}
${hasData ? `
CONTEXTO (silencioso):
- Tempo estudado: ${totalStudyMin} min
- Dificuldades: ${weakSubjects.join(", ") || "nenhuma"}
- Revisões atrasadas: ${overdueReviews}
- Desempenho: ${context.performance.map((p: any) => `${p.materia}: ${p.accuracy}%${p.erro_recorrente ? " RECORRENTE" : ""}`).join("; ") || "sem dados"}` : `O aluno "${nome}" é novo. Sugira primeira ação concreta.`}
${buildAdaptiveBlock(context)}
${olderSummary}${recentChatSummary}`;
    }

    // ─── ACTIONS ───────────────────────────────────────────────────────────

    // Chat principal
    if (action === "recommend") {
      const context = await getStudentContext(userId);
      const systemPrompt = buildSystemPrompt(context);
      const userPrompt = data?.message || "Me ajuda a organizar meus estudos?";

      const normalizedPrompt = (userPrompt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.!?,;:]+/g, " ").replace(/\s+/g, " ").trim();
      const confirmPhrases = ["sim","s","ok","okay","claro","pode","pode ser","pode fazer","pode mandar","pode salvar","pode criar","pode gerar","manda","manda ver","manda bala","bora","bora la","vamos","vamos la","vamos nessa","faz","faca","faz isso","faz ai","faz ae","salva","cria","gera","gere","confirma","confirmo","isso","isso ai","isso mesmo","certo","beleza","blz","fechou","fechado","ta","ta bom","ta certo","tabom","uhum","aham","yep","yes","y","quero","quero sim","positivo","vai","vai la","vai nessa","manda ai","demorou","valeu","show","perfeito","otimo","legal"];
      const isConfirmation = normalizedPrompt.length > 0 && normalizedPrompt.split(" ").length <= 6 && confirmPhrases.some(p => normalizedPrompt === p || normalizedPrompt.startsWith(p + " ") || normalizedPrompt.endsWith(" " + p));

      // Pedido direto com verbo imperativo ("gere um quiz", "faz um resumo", "monta cronograma")
      // conta como ação direta — não precisa confirmar de novo.
      const directActionVerbs = ["gere","gera","gerar","faz","faca","fazer","cria","criar","monta","montar","manda","mandar","quero","preciso","me da","me de","me passa","me faz","me gera","me cria","me manda","me monta"];
      const isDirectActionRequest = directActionVerbs.some(v => normalizedPrompt === v || normalizedPrompt.startsWith(v + " "));

      const guardNote = (isConfirmation || isDirectActionRequest)
        ? `

[INTERNO]: O aluno PEDIU/CONFIRMOU diretamente ("${userPrompt.slice(0, 80)}"). EXECUTE AGORA incluindo [AÇÃO:...] no final com payload completo. Resposta no chat: 1 frase curta tipo "Abrindo." ou "Pronto, no caderno." NUNCA escreva o conteúdo (questões, resumo, redação) inline — TUDO vai no payload da ação. OBRIGATÓRIO terminar a resposta com o bloco [AÇÃO:...].`
        : `

[INTERNO]: O aluno NÃO confirmou. Apenas sugira e pergunte. PROIBIDO incluir [AÇÃO:...] nesta resposta.`;

      // Limita histórico a 12 msgs para reduzir tokens enviados à IA (~-40% em conversas longas)
      const trimmedHistory = (data?.history || []).slice(-12);
      const chatMessages = [
        { role: "system", content: systemPrompt + guardNote },
        ...trimmedHistory,
        { role: "user", content: userPrompt },
      ];

      const streamResp = await callAIStream(chatMessages);

      // Se não confirmou, filtra [AÇÃO:...] do stream
      if (!isConfirmation && streamResp.body) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const reader = streamResp.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        let braceDepth = -1; let inString = false; let escapeNext = false;
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read(); if (done) break;
              buf += decoder.decode(value, { stream: true });
              let nl: number;
              while ((nl = buf.indexOf("\n")) !== -1) {
                let line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (line.endsWith("\n")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) { await writer.write(encoder.encode(line + "\n")); continue; }
                const jsonStr = line.slice(6).trim(); if (jsonStr === "[DONE]") { await writer.write(encoder.encode(line + "\n")); continue; }
                try {
                  const parsed = JSON.parse(jsonStr); const content: string | undefined = parsed.choices?.[0]?.delta?.content;
                  if (typeof content === "string" && content.length > 0) {
                    let out = ""; let pending = "";
                    for (const ch of content) {
                      if (braceDepth === -1) {
                        pending += ch; const idx = pending.indexOf("[AÇÃO:");
                        if (idx !== -1) { out += pending.slice(0, idx); pending = pending.slice(idx); braceDepth = 0; continue; }
                        if (pending.length > 7) { out += pending.slice(0, pending.length - 7); pending = pending.slice(-7); }
                      } else if (braceDepth === 0) { if (ch === "{") { braceDepth = 1; inString = false; escapeNext = false; } }
                      else {
                        if (escapeNext) { escapeNext = false; } else if (ch === "\\" && inString) { escapeNext = true; } else if (ch === '"') { inString = !inString; }
                        else if (!inString) { if (ch === "{") braceDepth++; else if (ch === "}") { braceDepth--; if (braceDepth === 0) { braceDepth = -1; pending = ""; } } }
                      }
                    }
                    if (braceDepth === -1) { out += pending; pending = ""; }
                    if (out.length > 0) { parsed.choices[0].delta.content = out; await writer.write(encoder.encode("data: " + JSON.stringify(parsed) + "\n")); }
                  } else { await writer.write(encoder.encode(line + "\n")); }
                } catch { await writer.write(encoder.encode(line + "\n")); }
              }
            }
            if (buf) await writer.write(encoder.encode(buf));
          } catch (e) { console.error("stream filter error:", e); }
          finally { await writer.close(); }
        })();
        return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }
      return streamResp;
    }

    if (action === "save_chat") {
      const messages = data?.messages;
      if (!Array.isArray(messages) || messages.length === 0) return jsonResponse({ ok: true });
      await supabase.from("flora_chat_messages").delete().eq("user_id", userId);
      const inserts = messages.slice(-80).map((m: any) => ({ user_id: userId, role: m.role, content: m.content?.slice(0, 4000) || "" }));
      await supabase.from("flora_chat_messages").insert(inserts);
      return jsonResponse({ ok: true, saved: inserts.length });
    }

    if (action === "load_chat") {
      const { data: messages } = await supabase.from("flora_chat_messages").select("role, content, created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(80);
      return jsonResponse({ messages: messages ?? [] });
    }

    if (action === "execute_action") {
      const actionType = data?.actionType;

      if (actionType === "CRONOGRAMA" && data?.payload?.slots) {
        const slots = data.payload.slots;
        await supabase.from("weekly_slots").delete().eq("user_id", userId);
        await supabase.from("weekly_slots").insert(slots.map((s: any, i: number) => ({ id: `flora-${Date.now()}-${i}`, user_id: userId, dia: typeof s.dia === "number" ? s.dia : 0, horario: s.horario || "08:00", descricao: s.descricao || s.materia || "", materia: s.materia || null, concluido: false })));
        await supabase.from("user_actions").insert({ user_id: userId, action: "flora_create_schedule", metadata: { slotCount: slots.length } });
        return jsonResponse({ ok: true, message: "Cronograma criado!", slotCount: slots.length });
      }

      if (actionType === "REMOVER_CRONOGRAMA" && data?.payload) {
        const { materia, dia, horario } = data.payload;
        let query = supabase.from("weekly_slots").delete().eq("user_id", userId);
        if (materia) query = query.eq("materia", materia);
        if (typeof dia === "number") query = query.eq("dia", dia);
        if (horario) query = query.eq("horario", horario);
        await query;
        return jsonResponse({ ok: true, type: "remove_schedule" });
      }

      if (actionType === "QUIZ" && data?.payload) {
        const qChk = await checkQuota(supabase, userId, "generate_quiz");
        if (!qChk.allowed) return quotaExceededResponse(qChk, corsHeaders);
        const { materia, tema, difficulty } = data.payload;
        const context = await getStudentContext(userId);
        const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
        const objCtx = getObjetivoContext(objetivo);
        const perfData = context.performance.filter((p: any) => p.materia === materia);
        const accuracyMedia = perfData.length > 0 ? Math.round(perfData.reduce((a: number, p: any) => a + p.accuracy, 0) / perfData.length) : 50;
        const errosRecorrentes = perfData.filter((p: any) => p.erro_recorrente).map((p: any) => p.materia);

        const opts: CallOptions = {
          messages: [
            { role: "system", content: `Você é Flora, professora especialista em ${objCtx.label}. Gere 8 questões NO PADRÃO REAL ${objCtx.label} sobre "${tema}" (${materia}). NÍVEL: ${accuracyMedia}% de acerto. Dificuldade: ${difficulty || "medio"}. ERROS RECORRENTES: ${errosRecorrentes.join(", ") || "nenhum"}. ESTILO: ${objCtx.quizStyle}.

REGRAS OBRIGATÓRIAS DE CADA QUESTÃO (estilo ${objCtx.label} REAL — NÃO aceitar pergunta seca):
1) TEXTO-BASE rico e contextualizado (mínimo 4 linhas): situação real, trecho de notícia/artigo/livro, dado científico, tabela descrita em texto, gráfico descrito ("O gráfico mostra que..."), charge descrita, citação de autor, contexto histórico/social/cotidiano. NUNCA comece direto com a pergunta.
2) COMANDO claro DEPOIS do texto-base (ex: "Com base no texto acima, é correto afirmar que:", "A partir da situação descrita, conclui-se que:", "Considerando o gráfico apresentado, o fenômeno observado se deve a:").
3) INTERPRETAÇÃO obrigatória: o aluno PRECISA ler e raciocinar sobre o texto-base — não pode responder só sabendo decoreba. Conecte conteúdo da matéria com a situação apresentada.
4) PEGADINHA LEVE: pelo menos 2 distratores plausíveis (afirmações que parecem certas mas têm um erro sutil — inversão de causa/efeito, conceito parecido, generalização indevida, número trocado, etiologia errada).
5) ${objetivo === "concurso" ? "4 alternativas (A-D)" : "5 alternativas (A-E)"}, todas do MESMO tamanho aproximado, todas plausíveis, sem "todas/nenhuma das anteriores".
6) EXPLICAÇÃO completa: por que a correta está certa + por que CADA um dos 2 distratores mais plausíveis está errado + dica de pegadinha.
7) UNICIDADE DA RESPOSTA (CRÍTICO): APENAS UMA alternativa pode estar 100% correta. As demais DEVEM conter erro factual, conceitual ou lógico claro e demonstrável. PROIBIDO ter duas alternativas que possam ser defendidas como corretas. PROIBIDO ambiguidade, sinônimos que digam a mesma coisa, ou afirmações parcialmente certas sem erro objetivo. Antes de finalizar, RELEIA cada distrator e confirme: "este tem um erro específico que posso apontar". Se houver QUALQUER dúvida sobre unicidade, reescreva o distrator.
8) JUSTIFICATIVA ÚNICA: na explicação, deixe explícito o critério objetivo que torna a correta a ÚNICA possível (regra, lei, dado, definição) — não apenas "é a mais adequada".

PROIBIDO: pergunta solta sem contexto, "qual é a definição de X?", "marque a alternativa correta sobre Y" sem texto-base, alternativas óbvias ou de tamanhos muito diferentes, explicação curta de 1 linha, DUAS ALTERNATIVAS CORRETAS, ambiguidade entre alternativas, comandos vagos ("a melhor opção" sem critério claro).

Responda SOMENTE com JSON: {"questions":[{"pergunta":"TEXTO-BASE COMPLETO\\n\\nCOMANDO DA QUESTÃO","alternativas":["A) ...","B) ...","C) ...","D) ..."${objetivo === "concurso" ? "" : ',"E) ..."'}],"correta":0,"explicacao":"...","dificuldade":"facil|medio|dificil"}]}\nSEMPRE responda em português brasileiro.` },
            { role: "user", content: `Gere um quiz de ${materia} sobre ${tema}.` },
          ],
          maxTokens: 1500, temperature: 0.5, jsonMode: true,
        };
        // Quiz: Groq como primário
        const content = await runTaskChain(opts, "quiz", "flora:quiz", { supabase, userId, actionType: "generate_quiz" });
        const result = parseAIJSON(content as string) as any;
        await supabase.from("user_actions").insert({ user_id: userId, action: "flora_generate_quiz", materia, metadata: { tema, difficulty, questionCount: result.questions?.length || 0 } });
        return jsonResponse({ ok: true, type: "quiz", materia, tema, ...result });
      }

      if (actionType === "FLASHCARDS" && data?.payload) {
        const qChk = await checkQuota(supabase, userId, "generate_flashcards");
        if (!qChk.allowed) return quotaExceededResponse(qChk, corsHeaders);
        const { materia, tema } = data.payload;
        const context = await getStudentContext(userId);
        const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
        const objCtx = getObjetivoContext(objetivo);
        const perfData = context.performance.filter((p: any) => p.materia === materia);
        const accuracyMedia = perfData.length > 0 ? Math.round(perfData.reduce((a: number, p: any) => a + p.accuracy, 0) / perfData.length) : 50;

        const opts: CallOptions = {
          messages: [
            { role: "system", content: `Você é Flora, professora especialista em ${objCtx.label}. Gere 8-12 flashcards de "${tema}" (${materia}). NÍVEL: ${accuracyMedia}% de acerto.
Regras: frente variada (cotidiano, comparação, causa-efeito, aplicação); verso = resposta completa + mecanismo + exemplo + pegadinha do ${objCtx.label}. Mínimo 2 cotidiano, 1 comparação. Resumo 6+ linhas. Fórmulas em LaTeX.
UNICIDADE (CRÍTICO): cada flashcard deve ter UMA resposta correta, objetiva e sem ambiguidade. Frente não pode admitir múltiplas interpretações. Verso deve ser factualmente único e justificável (citar regra/lei/definição quando cabível). PROIBIDO frente vaga ("fale sobre X") ou verso aberto.
Responda SOMENTE com JSON: {"resumo":"...","flashcards":[{"frente":"...","verso":"...","tipo":"definição|aplicação|comparação|cotidiano|causa-efeito"}]}\nSEMPRE responda em português brasileiro.` },
            { role: "user", content: `Gere flashcards de ${materia} sobre ${tema}.` },
          ],
          maxTokens: 1200, temperature: 0.5, jsonMode: true,
        };
        // Flashcards: Gemini 2.0-flash como primário (ótimo em síntese)
        const task: TaskType = isExatasTask(materia) ? "exatas" : "flashcard";
        const content = await runTaskChain(opts, task as TaskType, "flora:flashcard", { supabase, userId, actionType: "generate_flashcards" });
        const result = parseAIJSON(content as string) as any;
        await supabase.from("user_actions").insert({ user_id: userId, action: "flora_generate_flashcards", materia, metadata: { tema, cardCount: result.flashcards?.length || 0 } });
        return jsonResponse({ ok: true, type: "flashcards", materia, tema, ...result });
      }

      if (actionType === "POMODORO" && data?.payload) return jsonResponse({ ok: true, type: "pomodoro", ...data.payload });

      if (actionType === "CADERNO" && data?.payload) {
        const { titulo, materia, conteudo } = data.payload;
        const notebookId = crypto.randomUUID(); const pageId = crypto.randomUUID();
        await supabase.from("notebooks").insert({ id: notebookId, user_id: userId, title: titulo || "Novo Caderno", subject: materia || null, cover_color: "#3B82F6" });
        await supabase.from("notebook_pages").insert({ id: pageId, notebook_id: notebookId, user_id: userId, page_number: 1, content: conteudo || "" });
        await supabase.from("user_actions").insert({ user_id: userId, action: "flora_create_notebook", metadata: { titulo, materia, notebookId } });
        return jsonResponse({ ok: true, type: "notebook", notebookId, titulo });
      }

      if (actionType === "META_DIA" && data?.payload) {
        const { studyMinutes, revisions, quizCount } = data.payload;
        const { data: existing } = await supabase.from("gamification_profiles").select("state").eq("user_id", userId).maybeSingle();
        const currentState = (existing?.state as Record<string, unknown>) || {};
        const newState = { ...currentState, dailyGoals: { studyMinutes: studyMinutes ?? (currentState as any)?.dailyGoals?.studyMinutes ?? 30, revisions: revisions ?? (currentState as any)?.dailyGoals?.revisions ?? 5, quizCount: quizCount ?? (currentState as any)?.dailyGoals?.quizCount ?? 1 } };
        await supabase.from("gamification_profiles").upsert({ user_id: userId, state: newState }, { onConflict: "user_id" });
        return jsonResponse({ ok: true, type: "meta_dia", studyMinutes, revisions, quizCount });
      }

      return jsonResponse({ error: "Ação desconhecida" }, 400);
    }

    if (action === "decide_next_topic") {
      const context = await getStudentContext(userId);
      const opts: CallOptions = {
        messages: [
          { role: "system", content: `Você é Flora. Analise e sugira o melhor tópico pra estudar agora. DADOS: ${JSON.stringify({ onboarding: context.onboarding, performance: context.performance, pendingReviews: context.pendingReviews, recentActions: context.recentActions })}
Responda SOMENTE com JSON: {"topic_id":"...","materia":"...","tema":"...","formato":"quiz|explicacao|resumo|exercicio","razao":"frase curta específica","prioridade":"alta|media|baixa"}\nSEMPRE responda em português brasileiro.` },
          { role: "user", content: "Qual o melhor tópico para estudar agora?" },
        ],
        maxTokens: 600, temperature: 0.5, jsonMode: true,
      };
      // Planejamento: Groq como primário
      const content = await runTaskChain(opts, "plano", "flora:decide", { supabase, userId, actionType: "decide_next_topic" });
      const decision = parseAIJSON(content as string) as any;
      await supabase.from("flora_decisions").insert({ user_id: userId, decision_type: "next_topic", reasoning: decision.razao || "", recommendation: decision });
      return jsonResponse(decision);
    }

    if (action === "study_now") {
      const context = await getStudentContext(userId);
      const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
      const objCtx = getObjetivoContext(objetivo);
      const opts: CallOptions = {
        messages: [
          { role: "system", content: `Você é Flora, especialista em ${objCtx.label}. O aluno quer estudar agora. Escolha o tópico mais urgente e gere uma AULA COMPLETA.
DADOS: ${JSON.stringify({ onboarding: context.onboarding, performance: context.performance, pendingReviews: context.pendingReviews })}
Conteúdo mínimo: 35 linhas. Formato markdown:
## [Tema] — Aula ${objCtx.label}
**O que é:** | **Como funciona:** | **Tipos:** | **Exemplos:** | **Como ${objCtx.label} cobra:** | **Conexões:** | **Pegadinha:** | **Questão de fixação:**
Responda SOMENTE com JSON: {"topic_id":"...","materia":"...","tema":"...","formato":"explicacao","razao":"frase motivadora","conteudo":"aula completa em markdown"}\nSEMPRE responda em português brasileiro.` },
          { role: "user", content: "Quero estudar agora." },
        ],
        maxTokens: 3000, temperature: 0.55,
      };
      // study_now: detecta matéria para escolher provider ideal
      const content = await runTaskChain(opts, "explicacao", "flora:study_now", { supabase, userId, actionType: "decide_next_topic" });
      const result = parseAIJSON(content as string) as any;
      await supabase.from("flora_decisions").insert({ user_id: userId, decision_type: "study_now", reasoning: result.razao || "", recommendation: result });
      await supabase.from("user_actions").insert({ user_id: userId, action: "study_now", topic_id: result.topic_id || null, materia: result.materia || null, metadata: { formato: result.formato } });
      return jsonResponse(result);
    }

    if (action === "generate_quiz") {
      const context = await getStudentContext(userId);
      const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
      const objCtx = getObjetivoContext(objetivo);
      const materia = data?.materia || "geral";
      const tema = data?.tema || "tema geral";
      const difficulty = data?.difficulty || "medio";
      const pageContent = (data?.pageContent || "").toString().slice(0, 5000);
      const requestedCount = Math.max(3, Math.min(20, Number(data?.questionCount) || 8));
      const mode = data?.mode === "review_errors" ? "review_errors" : "normal";
      const previousErrors: string[] = Array.isArray(data?.previousErrors) ? data.previousErrors.slice(0, 10).map((s: unknown) => String(s).slice(0, 300)) : [];
      const perfData = context.performance.filter((p: any) => p.materia === materia);
      const accuracyMedia = perfData.length > 0 ? Math.round(perfData.reduce((a: number, p: any) => a + p.accuracy, 0) / perfData.length) : 50;
      const reviewBlock = mode === "review_errors" && previousErrors.length > 0 ? `
MODO REVISÃO: gere questões NOVAS sobre esses conceitos:
${previousErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}
` : "";

      const altCount = objetivo === "concurso" ? 4 : 5;
      const altLetters = objetivo === "concurso" ? "A-D" : "A-E";
      const altExample = objetivo === "concurso"
        ? `["A) ...","B) ...","C) ...","D) ..."]`
        : `["A) ...","B) ...","C) ...","D) ...","E) ..."]`;

      const opts: CallOptions = {
        messages: [
          { role: "system", content: `Você é Flora, examinadora especialista em ${objCtx.label}. Gere ${requestedCount} questões NO PADRÃO REAL ${objCtx.label} sobre "${tema}" (${materia}). NÍVEL aluno: ${accuracyMedia}% acerto. Dificuldade: ${difficulty}. ESTILO: ${objCtx.quizStyle}.${pageContent ? `\nBASE DE CONTEÚDO: ${pageContent}` : ""}${reviewBlock}

REGRAS OBRIGATÓRIAS DE CADA QUESTÃO (estilo ${objCtx.label} REAL — proibido pergunta seca):
1) TEXTO-BASE rico (mínimo 4 linhas): situação real, trecho de notícia/artigo/livro, dado científico, tabela/gráfico descritos em texto, citação, contexto histórico/social/cotidiano. NUNCA comece direto com a pergunta.
2) COMANDO claro DEPOIS do texto-base ("Com base no texto, é correto afirmar:", "A partir da situação descrita, conclui-se que:", "Considerando o gráfico apresentado, o fenômeno se deve a:").
3) INTERPRETAÇÃO obrigatória: o aluno precisa LER e RACIOCINAR sobre o texto — não pode responder só por decoreba.
4) PEGADINHA LEVE: pelo menos 2 distratores plausíveis (parecem certos mas têm erro sutil — inversão de causa/efeito, conceito parecido, generalização indevida, número trocado, etiologia errada).
5) ${altCount} alternativas (${altLetters}), todas com tamanho aproximado, todas plausíveis, sem "todas/nenhuma das anteriores".
6) UNICIDADE DA RESPOSTA (CRÍTICO E INEGOCIÁVEL): APENAS UMA alternativa pode estar 100% correta. As demais DEVEM conter erro factual, conceitual ou lógico claro e demonstrável. PROIBIDO duas alternativas defensáveis. PROIBIDO sinônimos que digam a mesma coisa. PROIBIDO afirmações parcialmente certas sem erro objetivo. ANTES de finalizar cada questão, faça este TESTE INTERNO por eliminação:
   - Para cada distrator, escreva mentalmente: "este está errado porque ___ (regra/lei/dado específico)". Se NÃO conseguir apontar erro objetivo, REESCREVA o distrator.
   - Para a correta, escreva: "esta é a única certa porque ___ (regra/lei/dado)". Se outro distrator também passar nesse critério, REESCREVA.
7) JUSTIFICATIVA ÚNICA: na "explicacao", deixe explícito o critério objetivo (regra, lei, dado, definição) que torna a correta a ÚNICA possível + por que CADA um dos 2 distratores mais plausíveis está errado + a pegadinha.
8) NÍVEL ${objCtx.label}: leitura exigente, interpretação profunda, análise — NÃO básico, NÃO direto, NÃO superficial.

PROIBIDO: pergunta solta sem contexto; "qual é a definição de X?"; "marque a alternativa correta sobre Y" sem texto-base; alternativas óbvias ou de tamanhos muito diferentes; explicação de 1 linha; DUAS ALTERNATIVAS CORRETAS; ambiguidade; comandos vagos ("a melhor opção" sem critério); leitura simples sem armadilha.

Responda SOMENTE com JSON: {"questions":[{"pergunta":"TEXTO-BASE COMPLETO\\n\\nCOMANDO DA QUESTÃO","alternativas":${altExample},"correta":0,"explicacao":"Correta (X): [critério único]. Distrator Y errado porque [erro objetivo]. Distrator Z errado porque [erro objetivo]. Pegadinha: [...].","dificuldade":"facil|medio|dificil"}]}
SEMPRE responda em português brasileiro.` },
          { role: "user", content: `Gere um quiz de ${materia} sobre ${tema} no padrão ${objCtx.label} real, com texto-base, interpretação e UMA única resposta correta inequivocamente justificável.` },
        ],
        maxTokens: Math.min(350 * requestedCount + 800, 4000), temperature: 0.45, jsonMode: true,
      };
      // Quiz: Groq como primário
      const content = await runTaskChain(opts, "quiz", "flora:generate_quiz", { supabase, userId, actionType: "generate_quiz" });
      const result = parseAIJSON(content as string) as any;

      // ─── AUDITORIA INEP: valida unicidade de cada questão ───
      // Para cada questão, pede à IA p/ classificar TODAS as alternativas como correta/incorreta.
      // Se 0 ou >1 corretas → descarta e tenta regenerar 1 vez.
      const auditQuestion = async (q: any): Promise<{ valid: boolean; correctIndexes: number[] }> => {
        try {
          const auditOpts: CallOptions = {
            messages: [
              { role: "system", content: `Você é um corretor oficial INEP. Analise CADA alternativa individualmente como correta ou incorreta, com lógica objetiva. PROIBIDO usar "mais adequada", "melhor opção", "não é o foco". Responda SOMENTE JSON: {"analise":[{"letra":"A","status":"correta|incorreta","motivo":"..."}],"corretas":[0]} onde "corretas" é o array de ÍNDICES (0-based) das alternativas 100% corretas.` },
              { role: "user", content: `Questão:\n${q.pergunta}\n\nAlternativas:\n${(q.alternativas || []).map((a: string, i: number) => `[${i}] ${a}`).join("\n")}\n\nGabarito proposto: índice ${q.correta}.\n\nAvalie cada alternativa e liste TODAS as que estão 100% corretas.` },
            ],
            maxTokens: 800, temperature: 0.1, jsonMode: true,
          };
          const auditContent = await runTaskChain(auditOpts, "quiz", "flora:audit_question");
          const audit = parseAIJSON(auditContent as string) as any;
          const corretas: number[] = Array.isArray(audit?.corretas)
            ? audit.corretas.filter((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < (q.alternativas?.length || 0))
            : [];
          return { valid: corretas.length === 1, correctIndexes: corretas };
        } catch (_e) {
          return { valid: true, correctIndexes: [q.correta] };
        }
      };

      const regenerateOne = async (): Promise<any | null> => {
        try {
          const regenOpts: CallOptions = {
            messages: [
              { role: "system", content: (opts.messages[0].content as string) + `\n\nIMPORTANTE: a questão anterior foi REPROVADA por ambiguidade (mais de uma correta ou nenhuma). REGENERE com UMA única resposta correta e demonstrável por critério objetivo.` },
              { role: "user", content: `Gere UMA nova questão sobre ${tema} (${materia}), padrão ${objCtx.label}, com texto-base, interpretação e UMA única resposta correta. Responda SOMENTE JSON: {"questions":[{...}]} com 1 questão.` },
            ],
            maxTokens: 1200, temperature: 0.4, jsonMode: true,
          };
          const regenContent = await runTaskChain(regenOpts, "quiz", "flora:regen_question");
          const regen = parseAIJSON(regenContent as string) as any;
          return regen?.questions?.[0] || null;
        } catch (_e) {
          return null;
        }
      };

      let discarded = 0;
      if (Array.isArray(result?.questions) && result.questions.length > 0) {
        const audited: any[] = [];
        for (const q of result.questions) {
          const { valid, correctIndexes } = await auditQuestion(q);
          if (valid) {
            if (correctIndexes[0] !== q.correta) q.correta = correctIndexes[0];
            audited.push(q);
            continue;
          }
          const fixed = await regenerateOne();
          if (fixed) {
            const reAudit = await auditQuestion(fixed);
            if (reAudit.valid) {
              if (reAudit.correctIndexes[0] !== fixed.correta) fixed.correta = reAudit.correctIndexes[0];
              audited.push(fixed);
              continue;
            }
          }
          discarded++;
          console.warn(`[flora:quiz] questão descartada por ambiguidade INEP (${correctIndexes.length} corretas)`);
        }
        result.questions = audited;
      }

      await supabase.from("user_actions").insert({ user_id: userId, action: "generate_quiz", materia, metadata: { tema, difficulty, questionCount: result.questions?.length || 0, discarded, mode } });
      return jsonResponse(result);
    }

    if (action === "generate_flashcards") {
      const context = await getStudentContext(userId);
      const objetivo: Objetivo = context.onboarding?.objetivo || "enem";
      const objCtx = getObjetivoContext(objetivo);
      const materia = data?.materia || "geral";
      const tema = data?.tema || "tema geral";
      const pageContent = data?.pageContent || "";
      const perfData = context.performance.filter((p: any) => p.materia === materia);
      const accuracyMedia = perfData.length > 0 ? Math.round(perfData.reduce((a: number, p: any) => a + p.accuracy, 0) / perfData.length) : 50;

      const opts: CallOptions = {
        messages: [
          { role: "system", content: `Você é Flora, especialista em ${objCtx.label}. Gere 8-12 flashcards de "${tema}" (${materia}). NÍVEL: ${accuracyMedia}%.${pageContent ? `\nBASE: ${pageContent}` : ""}
Frente variada. Verso = resposta + mecanismo + exemplo + pegadinha do ${objCtx.label}. Resumo 6+ linhas. LaTeX para fórmulas.
Responda SOMENTE com JSON: {"resumo":"...","flashcards":[{"frente":"...","verso":"...","tipo":"definição|aplicação|comparação|cotidiano|causa-efeito"}]}
SEMPRE responda em português brasileiro.` },
          { role: "user", content: `Gere flashcards de ${materia} sobre ${tema}.` },
        ],
        maxTokens: 1200, temperature: 0.5, jsonMode: true,
      };
      // Flashcards: Gemini 2.0-flash para humanas, DeepSeek para exatas
      const task: TaskType = isExatasTask(materia) ? "exatas" : "flashcard";
      const content = await runTaskChain(opts, task as TaskType, "flora:flashcards", { supabase, userId, actionType: "generate_flashcards" });
      const result = parseAIJSON(content as string) as any;
      await supabase.from("user_actions").insert({ user_id: userId, action: "generate_flashcards", materia, metadata: { tema, cardCount: result.flashcards?.length || 0 } });
      return jsonResponse(result);
    }

    if (action === "generate_initial_plan") {
      const context = await getStudentContext(userId);
      const onb = context.onboarding;
      if (!onb) return jsonResponse({ error: "No onboarding data" }, 400);
      const objetivo: Objetivo = onb.objetivo || "enem";
      const objCtx = getObjetivoContext(objetivo);

      const opts: CallOptions = {
        messages: [
          { role: "system", content: `Você é Flora. Crie um cronograma semanal para ${objCtx.label}.
ALUNO: objetivo=${objCtx.label}, tempo=${onb.tempo_disponivel_min}min/dia, difíceis=${(onb.materias_dificeis || []).join(", ")}, rotina=${onb.rotina}, meta=${onb.meta_resultado}
Responda SOMENTE com JSON: {"plano":"...","slots":[{"dia":0,"horario":"14:00","materia":"...","descricao":"..."}]}
dia: 0=seg..6=dom. Max ${Math.floor(onb.tempo_disponivel_min / 30)} slots/dia.\nSEMPRE responda em português brasileiro.` },
          { role: "user", content: "Crie meu cronograma inicial." },
        ],
        maxTokens: 800, temperature: 0.5, jsonMode: true,
      };
      // Plano: Groq como primário (rápido e estruturado)
      const content = await runTaskChain(opts, "plano", "flora:initial_plan");
      const plan = parseAIJSON(content as string) as any;
      if (plan.slots?.length) {
        await supabase.from("weekly_slots").delete().eq("user_id", userId);
        await supabase.from("weekly_slots").insert(plan.slots.map((s: any, i: number) => ({ id: `flora-init-${Date.now()}-${i}`, user_id: userId, dia: typeof s.dia === "number" ? s.dia : 0, horario: s.horario || "08:00", descricao: s.descricao || s.materia || "", materia: s.materia || null, concluido: false })));
      }
      await supabase.from("flora_decisions").insert({ user_id: userId, decision_type: "initial_plan", reasoning: plan.plano || "", recommendation: plan });
      await supabase.from("user_actions").insert({ user_id: userId, action: "onboarding_plan_created", metadata: { slotCount: plan.slots?.length || 0 } });
      return jsonResponse(plan);
    }

    if (action === "log_action") {
      const { actionType, topicId, materia, metadata } = data;
      await supabase.from("user_actions").insert({ user_id: userId, action: actionType, topic_id: topicId || null, materia: materia || null, metadata: metadata || {} });
      if (topicId && (actionType === "quiz_correct" || actionType === "quiz_wrong")) {
        const { data: existing } = await supabase.from("student_performance").select("*").eq("user_id", userId).eq("topic_id", topicId).maybeSingle();
        const acertos = (existing?.acertos || 0) + (actionType === "quiz_correct" ? 1 : 0);
        const erros = (existing?.erros || 0) + (actionType === "quiz_wrong" ? 1 : 0);
        const total = acertos + erros;
        const accuracy = total > 0 ? Math.round((acertos / total) * 100) : 0;
        await supabase.from("student_performance").upsert({ user_id: userId, topic_id: topicId, materia: materia || "", acertos, erros, accuracy, erro_recorrente: erros >= 3, prioridade: Math.round(erros * 10 + (100 - accuracy)) }, { onConflict: "user_id,topic_id" });
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("Flora error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
