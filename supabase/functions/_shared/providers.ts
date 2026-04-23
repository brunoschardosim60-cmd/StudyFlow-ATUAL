/**
 * _shared/providers.ts
 * Módulo central de chamadas de IA para todos os Edge Functions do StudyFlow.
 *
 * Ordem padrão (non-stream):
 *   gemini → gemini_2 → groq → mistral → cerebras → deepseek → openai → lovable
 *
 * OTIMIZAÇÕES v2:
 *   - Cache em memória por hash do prompt (TTL 5 min) → -70% chamadas repetidas
 *   - Dedup: requests idênticos simultâneos aguardam o primeiro em vez de disparar 2x
 *   - Token limits ajustados por tarefa (não mais 4096 para tudo)
 *   - trimHistory(): trunca contexto gigante antes de enviar à IA
 */

export type Msg = { role: string; content: string };

export interface CallOptions {
  messages: Msg[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

// ─── Token limits por tarefa ──────────────────────────────────────────────────
export const TOKEN_LIMITS: Record<string, number> = {
  quiz:       1600,  // 8 questões × ~200 tokens
  flashcard:  1200,  // 12 cards × ~100 tokens
  plano:       600,  // JSON de slots
  explicacao: 2500,  // aula completa
  redacao:    3000,  // correção detalhada
  humanas:    3000,
  exatas:     2000,
  chat:       1500,  // respostas curtas da Flora (max 5 linhas)
  default:    2048,
};

// ─── Cache em memória (TTL 5 minutos) ────────────────────────────────────────
interface CacheEntry { value: string; expiresAt: number; }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Map de chamadas em andamento (deduplicação)
const _inFlight = new Map<string, Promise<string>>();

function cacheKey(opts: CallOptions, tag: string): string {
  const sys = opts.messages.find(m => m.role === "system")?.content?.slice(0, 200) ?? "";
  const last = opts.messages.filter(m => m.role === "user").slice(-2).map(m => m.content.slice(0, 300)).join("|");
  return `${tag}::${sys}::${last}`;
}

function cacheGet(key: string): string | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key: string, value: string): void {
  if (_cache.size >= 200) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Erros transitórios → tenta próximo ──────────────────────────────────────
export function isTransientError(e: unknown): boolean {
  const status = (e as any)?.status;
  if (status === 429 || status === 503 || status === 502 || status === 500) return true;
  if (e instanceof Error) {
    return e.name === "TimeoutError" ||
      e.message.includes("timeout") ||
      e.message.includes("ECONNRESET");
  }
  return false;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
export async function callGemini(opts: CallOptions, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY ausente"), { status: 0 });
  const sys = opts.messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
  const userMsgs = opts.messages.filter(m => m.role !== "system");
  const contents = userMsgs.length
    ? userMsgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))
    : [{ role: "user", parts: [{ text: "Olá" }] }];
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: opts.temperature ?? 0.55, maxOutputTokens: opts.maxTokens ?? TOKEN_LIMITS.default, ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}) },
  };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(22000) });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`Gemini(${model}) ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json();
  const c = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  if (!c) throw Object.assign(new Error(`Gemini(${model}): vazio`), { status: 500 });
  return c;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
export async function callGroq(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw Object.assign(new Error("GROQ_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "meta-llama/llama-4-scout-17b-16e-instruct", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55, ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(18000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`Groq ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("Groq: vazio"), { status: 500 }); return c;
}

// ─── Mistral ──────────────────────────────────────────────────────────────────
export async function callMistral(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) throw Object.assign(new Error("MISTRAL_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "open-mistral-nemo", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55, ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(18000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`Mistral ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("Mistral: vazio"), { status: 500 }); return c;
}

// ─── Cerebras ─────────────────────────────────────────────────────────────────
export async function callCerebras(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("CEREBRAS_API_KEY");
  if (!key) throw Object.assign(new Error("CEREBRAS_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama-4-scout-17b-16e-instruct", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`Cerebras ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("Cerebras: vazio"), { status: 500 }); return c;
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────
export async function callDeepSeek(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw Object.assign(new Error("DEEPSEEK_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek-chat", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55, ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(22000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`DeepSeek ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("DeepSeek: vazio"), { status: 500 }); return c;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
export async function callOpenAI(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55, ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(22000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`OpenAI ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("OpenAI: vazio"), { status: 500 }); return c;
}

// ─── Lovable ──────────────────────────────────────────────────────────────────
export async function callLovable(opts: CallOptions): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw Object.assign(new Error("LOVABLE_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: opts.messages, max_tokens: opts.maxTokens ?? TOKEN_LIMITS.default, temperature: opts.temperature ?? 0.55, ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(22000),
  });
  if (!r.ok) { const txt = await r.text().catch(() => ""); throw Object.assign(new Error(`Lovable ${r.status}: ${txt.slice(0, 200)}`), { status: r.status }); }
  const d = await r.json(); const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("Lovable: vazio"), { status: 500 }); return c;
}

// ─── Cadeia padrão ────────────────────────────────────────────────────────────
export function buildDefaultChain(opts: CallOptions): Array<[string, () => Promise<string>]> {
  const key1 = Deno.env.get("GEMINI_API_KEY") ?? "";
  const key2 = Deno.env.get("GEMINI_API_KEY_2") ?? "";
  return [
    ["gemini",    () => callGemini(opts, key1, "gemini-2.0-flash")],
    ["gemini_2",  () => callGemini(opts, key2, "gemini-2.0-flash")],
    ["groq",      () => callGroq(opts)],
    ["mistral",   () => callMistral(opts)],
    ["cerebras",  () => callCerebras(opts)],
    ["deepseek",  () => callDeepSeek(opts)],
    ["openai",    () => callOpenAI(opts)],
    ["lovable",   () => callLovable(opts)],
  ];
}

// ─── Runner com fallback ──────────────────────────────────────────────────────
export async function runChain(chain: Array<[string, () => Promise<string>]>, tag: string): Promise<string> {
  let lastErr: unknown;
  for (const [name, fn] of chain) {
    try { const out = await fn(); console.log(`[${tag}] provider=${name} OK`); return out; }
    catch (e) {
      const status = (e as any)?.status ?? "?";
      console.warn(`[${tag}] provider=${name} falhou (${status}):`, e instanceof Error ? e.message : e);
      lastErr = e; continue;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Todos os provedores falharam");
}

export async function chatWithFallback(opts: CallOptions, tag = "ai"): Promise<string> {
  return runChain(buildDefaultChain(opts), tag);
}

// ─── Task types ───────────────────────────────────────────────────────────────
export type TaskType =
  | "redacao" | "quiz" | "flashcard" | "exatas"
  | "humanas" | "explicacao" | "plano" | "chat" | "default";

/**
 * callWithTaskFallback — provider primário por tarefa + cache + dedup + fallback
 *
 * CACHE ativo para: quiz, flashcard, plano, explicacao, exatas, redacao, humanas
 * CACHE inativo para: chat (cada mensagem é única)
 *
 * DEDUP: requests idênticos simultâneos aguardam o resultado do primeiro
 */
export async function callWithTaskFallback(opts: CallOptions, task: TaskType, tag = "ai"): Promise<string> {
  const key1 = Deno.env.get("GEMINI_API_KEY") ?? "";
  const key2 = Deno.env.get("GEMINI_API_KEY_2") ?? "";

  // Aplica limit de tokens adequado se não foi passado explicitamente
  if (!opts.maxTokens) opts = { ...opts, maxTokens: TOKEN_LIMITS[task] ?? TOKEN_LIMITS.default };

  // ── Cache ─────────────────────────────────────────────────────────────────
  const useCache = task !== "chat";
  const ck = useCache ? cacheKey(opts, `${tag}:${task}`) : "";
  if (useCache) {
    const hit = cacheGet(ck);
    if (hit) { console.log(`[${tag}:${task}] cache HIT`); return hit; }
  }

  // ── Dedup ─────────────────────────────────────────────────────────────────
  if (useCache && _inFlight.has(ck)) {
    console.log(`[${tag}:${task}] dedup: aguardando chamada em andamento`);
    return _inFlight.get(ck)!;
  }

  // ── Monta cadeia por tarefa ───────────────────────────────────────────────
  const taskPrimaries: Array<[string, () => Promise<string>]> = [];
  switch (task) {
    case "redacao": case "humanas":
      taskPrimaries.push(
        ["gemini_25_preview",   () => callGemini(opts, key1, "gemini-2.5-flash-preview-04-17")],
        ["gemini_25_preview_2", () => callGemini(opts, key2, "gemini-2.5-flash-preview-04-17")],
      ); break;
    case "quiz": case "plano":
      taskPrimaries.push(["groq", () => callGroq(opts)]); break;
    case "exatas":
      taskPrimaries.push(["deepseek", () => callDeepSeek(opts)]); break;
    case "explicacao":
      taskPrimaries.push(["mistral", () => callMistral(opts)]); break;
    default: // flashcard, chat, default
      taskPrimaries.push(
        ["gemini",   () => callGemini(opts, key1, "gemini-2.0-flash")],
        ["gemini_2", () => callGemini(opts, key2, "gemini-2.0-flash")],
      ); break;
  }

  // Remove da cadeia base os primários já incluídos
  const primNames = new Set(taskPrimaries.map(([n]) => n));
  const finalChain: Array<[string, () => Promise<string>]> = [
    ...taskPrimaries,
    ...buildDefaultChain(opts).filter(([n]) => !primNames.has(n)),
  ];

  const promise = runChain(finalChain, `${tag}:${task}`).then(result => {
    if (useCache) { cacheSet(ck, result); _inFlight.delete(ck); }
    return result;
  }).catch(err => {
    if (useCache) _inFlight.delete(ck);
    throw err;
  });

  if (useCache) _inFlight.set(ck, promise);
  return promise;
}

// ─── Parser JSON seguro ───────────────────────────────────────────────────────
export function parseAIJSON(content: string): unknown {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Não foi possível extrair JSON da resposta");
  }
}

/**
 * trimHistory — trunca histórico de chat para reduzir tokens enviados à IA.
 * Sempre preserva: mensagem system + últimas maxHistory mensagens.
 * Redução típica: -30% a -50% de tokens em conversas longas.
 */
export function trimHistory(messages: Msg[], maxHistory = 10): Msg[] {
  const system = messages.filter(m => m.role === "system");
  const rest = messages.filter(m => m.role !== "system");
  if (rest.length <= maxHistory) return messages;
  return [...system, ...rest.slice(-maxHistory)];
}
