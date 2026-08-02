import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

export const chat = onCall(
  {
    region: "us-central1",
    secrets: [OPENAI_API_KEY],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60
  },
  async (request) => {
    const message = String(request.data?.message || "").trim();
    if (!message) throw new HttpsError("invalid-argument", "Message cannot be empty.");
    if (message.length > 1000) throw new HttpsError("invalid-argument", "Message is too long.");

    try {
      const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const response = await client.responses.create({
        model: "gpt-5-mini",
        instructions: "You are a helpful, concise and friendly AI assistant.",
        input: message,
        max_output_tokens: 400,
        store: false
      });

      const reply = response.output_text?.trim();
      if (!reply) throw new Error("OpenAI returned no text.");
      return { reply };
    } catch (error) {
      console.error("OpenAI request failed", {
        name: error?.name,
        status: error?.status,
        code: error?.code,
        message: error?.message
      });

      if (error?.status === 401) throw new HttpsError("unauthenticated", "The OpenAI API key is invalid.");
      if (error?.status === 429) throw new HttpsError("resource-exhausted", "OpenAI quota or rate limit reached.");
      throw new HttpsError("internal", "The AI service could not respond.");
    }
  }
);
