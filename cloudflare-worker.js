// Paste this entire file into a Cloudflare Worker.
// Add OPENAI_API_KEY as an encrypted Worker Secret — never paste it into this code.

const ALLOWED_ORIGINS = new Set([
  "https://ym3178-afk.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function extractOutputText(responseData) {
  return (responseData.output || [])
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

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
    }

    if (url.pathname !== "/chat") {
      return jsonResponse({ error: "Not found." }, 404, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse({ error: "OPENAI_API_KEY secret is missing." }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400, origin);
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) {
      return jsonResponse({ error: "Message cannot be empty." }, 400, origin);
    }
    if (message.length > 1000) {
      return jsonResponse({ error: "Message is too long." }, 400, origin);
    }

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
      return jsonResponse({ error: "The Worker could not reach OpenAI." }, 502, origin);
    }

    let data = {};
    try {
      data = await openAIResponse.json();
    } catch (_) {
      // Handled below.
    }

    if (!openAIResponse.ok) {
      const code = data?.error?.code || "openai_error";
      const detail = data?.error?.message || `OpenAI returned HTTP ${openAIResponse.status}.`;
      return jsonResponse(
        { error: `OpenAI request failed: ${code}.`, detail },
        openAIResponse.status >= 500 ? 502 : openAIResponse.status,
        origin
      );
    }

    const reply = extractOutputText(data);
    if (!reply) {
      return jsonResponse({ error: "OpenAI returned no text." }, 502, origin);
    }

    return jsonResponse({ reply }, 200, origin);
  }
};
