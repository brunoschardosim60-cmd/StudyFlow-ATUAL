import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkQuota, logAIUsage, quotaExceededResponse } from "../_shared/usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vision fallback para solve-math:
// Gemini 2.0-flash (grátis, visão nativa) → Gemini 2.0-flash reserva (k2) → OpenAI gpt-4o-mini → Lovable
// Groq/Mistral/Cerebras/DeepSeek ficam de fora: não têm visão confiável para escrita à mão

async function callGeminiVision(imageDataUrl: string, systemPrompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  if (!apiKey) throw Object.assign(new Error(`Gemini key ausente`), { status: 0 });
  const m = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  const mime = m?.[1] || "image/png";
  const b64 = m?.[2] || imageDataUrl;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [
          { inlineData: { mimeType: mime, data: b64 } },
          { text: "Resolva as expressões matemáticas nesta imagem." },
        ] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(22000),
    }
  );
  if (!r.ok) { const t = await r.text().catch(() => ""); throw Object.assign(new Error(`Gemini(${model}) ${r.status}: ${t.slice(0,200)}`), { status: r.status }); }
  const d = await r.json();
  const c = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  if (!c) throw Object.assign(new Error(`Gemini(${model}): vazio`), { status: 500 });
  return c;
}

async function callOpenAIVision(imageDataUrl: string, systemPrompt: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          { type: "text", text: "Resolva as expressões matemáticas nesta imagem." },
        ] },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(22000),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw Object.assign(new Error(`OpenAI ${r.status}: ${t.slice(0,200)}`), { status: r.status }); }
  const d = await r.json();
  const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("OpenAI: vazio"), { status: 500 });
  return c;
}

async function callLovableVision(imageDataUrl: string, systemPrompt: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw Object.assign(new Error("LOVABLE_API_KEY ausente"), { status: 0 });
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          { type: "text", text: "Resolva as expressões matemáticas nesta imagem." },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(22000),
  });
  if (!r.ok) throw Object.assign(new Error(`Lovable ${r.status}: ${(await r.text().catch(() => "")).slice(0,200)}`), { status: r.status });
  const d = await r.json();
  const c = d.choices?.[0]?.message?.content;
  if (!c) throw Object.assign(new Error("Lovable: vazio"), { status: 500 });
  return c;
}

// Ordem: Gemini k1 → Gemini k2 → OpenAI → Lovable
async function visionWithFallback(imageDataUrl: string, systemPrompt: string): Promise<string> {
  const k1 = Deno.env.get("GEMINI_API_KEY") ?? "";
  const k2 = Deno.env.get("GEMINI_API_KEY_2") ?? "";

  const providers: Array<[string, () => Promise<string>]> = [
    ["gemini",   () => callGeminiVision(imageDataUrl, systemPrompt, k1, "gemini-2.0-flash")],
    ["gemini_2", () => callGeminiVision(imageDataUrl, systemPrompt, k2, "gemini-2.0-flash")],
    ["openai",   () => callOpenAIVision(imageDataUrl, systemPrompt)],
    ["lovable",  () => callLovableVision(imageDataUrl, systemPrompt)],
  ];

  let lastErr: unknown;
  for (const [name, fn] of providers) {
    try { const out = await fn(); console.log(`[solve-math] provider=${name} OK`); return out; }
    catch (e) { console.warn(`[solve-math] provider=${name} falhou (${(e as any)?.status ?? "?"}):`, e instanceof Error ? e.message : e); lastErr = e; continue; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Todos os provedores falharam");
}

const SYSTEM_PROMPT = `Você é um solver de matemática. Analise a imagem de expressões matemáticas escritas à mão e resolva.

REGRAS:
1. Identifique TODAS as expressões matemáticas na imagem
2. Resolva cada uma mostrando o resultado
3. Se houver erro do aluno, indique com is_correction: true
4. x_percent e y_percent indicam onde mostrar o resultado (0-100, relativo ao canvas)
5. stroke_height é a altura aproximada da escrita em % do canvas
6. expression_latex, result_latex e steps_latex em LaTeX puro válido para KaTeX (sem $...$, sem \\text, sem \\begin{align}). Use \\frac, \\sqrt, ^{}, _{}, \\cdot, \\pi, \\int, \\sum, \\lim
7. expression e result em texto plano (fallback). result_latex não inclui o "="

Responda SOMENTE com JSON válido:
{
  "solutions": [
    {
      "expression": "x^2 + 2x + 1",
      "expression_latex": "x^{2} + 2x + 1",
      "result": "(x+1)^2",
      "result_latex": "(x+1)^{2}",
      "x_percent": 70,
      "y_percent": 15,
      "stroke_height": 5,
      "is_correction": false,
      "user_answer": true,
      "steps": ["x^2 + 2x + 1 = (x+1)^2"],
      "steps_latex": ["x^{2} + 2x + 1 = (x+1)^{2}"],
      "confidence": 0.95
    }
  ]
}

Se não encontrar expressão matemática: {"solutions": []}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // ── Auth: rejeita requests sem JWT válido ────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
     // ── End auth ─────────────────────────────────────────────────────────────
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const quota = await checkQuota(adminClient, user.id, "solve_math");
    if (!quota.allowed) return quotaExceededResponse(quota, corsHeaders);

    const { imageBase64, previousResults } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const previousContext = Array.isArray(previousResults) && previousResults.length > 0
      ? `\nResultados anteriores já mostrados (NÃO repita): ${JSON.stringify(previousResults)}`
      : "";
    const systemPrompt = previousContext ? `${SYSTEM_PROMPT}\n${previousContext}` : SYSTEM_PROMPT;
    const imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;

    const content = await visionWithFallback(imageDataUrl, systemPrompt);
    let parsed;
    try { parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim()); }
    catch { parsed = { solutions: [] }; }

    void logAIUsage(adminClient, { userId: user.id, actionType: "solve_math", model: "gemini-2.0-flash", tokensIn: 500, tokensOut: 1000, success: true });

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Solve math error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const isQuota = /402|429|payment_required|quota|Not enough credits/i.test(msg);
    return new Response(
      JSON.stringify({
        error: isQuota ? "Créditos de IA esgotados. Tente novamente mais tarde." : msg,
        fallback: true,
        solutions: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
