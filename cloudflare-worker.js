// Deploy this file as a Cloudflare Worker.
// Add OPENAI_API_KEY under Settings -> Variables and Secrets -> Secret.

const ALLOWED_ORIGINS = new Set([
  "https://ym3178-afk.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data.output || [])
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part && part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (!isAllowedOrigin(origin)) {
      return json({ error: "Origin is not allowed." }, 403, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "elian-chatbot-worker" }, 200, origin);
    }

    if (url.pathname !== "/chat") {
      return json({ error: "Not found." }, 404, origin);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, origin);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY secret is missing." }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return json({ error: "Request body must be valid JSON." }, 400, origin);
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) return json({ error: "Message cannot be empty." }, 400, origin);
    if (message.length > 1000) return json({ error: "Message is too long." }, 400, origin);

    let openAIResponse;
    try {
      openAIResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          instructions: "You are a helpful AI assistant. Keep responses clear, concise, and friendly.",
          input: message,
          max_output_tokens: 300
        })
      });
    } catch (_) {
      return json({ error: "The Worker could not reach OpenAI." }, 502, origin);
    }

    const data = await openAIResponse.json().catch(() => ({}));
    if (!openAIResponse.ok) {
      return json({
        error: `OpenAI request failed: ${data?.error?.code || "openai_error"}.`,
        detail: data?.error?.message || `OpenAI returned HTTP ${openAIResponse.status}.`
      }, openAIResponse.status >= 500 ? 502 : openAIResponse.status, origin);
    }

    const reply = extractOutputText(data);
    if (!reply) return json({ error: "OpenAI returned no text." }, 502, origin);

    return json({ reply }, 200, origin);
  }
};
