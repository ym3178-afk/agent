import OpenAI from "openai";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const openAIKey = defineSecret("OPENAI_API_KEY");

export const chatWithAI = onCall(
  {
    region: "us-central1",
    secrets: [openAIKey],
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 5,
    enforceAppCheck: false
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must sign in before using the AI chat.");
    }

    const message = request.data?.message;
    if (typeof message !== "string" || !message.trim() || message.trim().length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Message must be a non-empty string of 500 characters or fewer."
      );
    }

    try {
      const client = new OpenAI({ apiKey: openAIKey.value() });
      const response = await client.responses.create({
        model: "gpt-5",
        instructions: "You are a helpful AI assistant. Keep responses concise and friendly.",
        input: message.trim(),
        max_output_tokens: 300
      });

      const responseText = response.output_text?.trim();
      if (!responseText) {
        logger.error("OpenAI returned no output text", { responseId: response.id });
        throw new HttpsError("internal", "The AI returned an empty response.");
      }

      logger.info("AI response generated", {
        uid: request.auth.uid,
        responseId: response.id
      });

      return { success: true, response: responseText };
    } catch (error) {
      if (error instanceof HttpsError) throw error;

      logger.error("OpenAI request failed", error);

      const status = Number(error?.status);
      if (status === 401 || status === 403) {
        throw new HttpsError("failed-precondition", "The server API key is invalid or lacks permission.");
      }
      if (status === 429) {
        throw new HttpsError("resource-exhausted", "OpenAI rate limit or account quota reached.");
      }
      if (status >= 500) {
        throw new HttpsError("unavailable", "OpenAI is temporarily unavailable.");
      }

      throw new HttpsError("internal", "Failed to generate an AI response.");
    }
  }
);
