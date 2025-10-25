// app/routes/api.cgproxy.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "Missing query" }, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "Missing OPENAI_API_KEY" }, 500);

  const prompt = `
Du er ekspert i køretøjsmål. Givet et modelnavn, returnér bedste estimat i centimeter og type {cykel|ladcykel|motorcykel}.
Svar KUN gyldig JSON med felter: type,length,width,height,confidence.
Model: "${q}"
`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 180,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!r.ok) return json({ error: "Upstream error" }, 502);
    const data = await r.json();
    let raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {}; try { parsed = JSON.parse(raw); } catch {}

    const t = String(parsed.type || "").toLowerCase();
    const type = ["cykel","ladcykel","motorcykel"].includes(t) ? t : "cykel";
    return json({
      type,
      length: Number(parsed.length || 210),
      width:  Number(parsed.width  || 80),
      height: Number(parsed.height || 120),
      confidence: Number(parsed.confidence || 0.5)
    });
  } catch (e: any) {
    return json({ error: "Proxy failure", detail: String(e) }, 500);
  }
}

function json(obj: any, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
