import { GoogleGenAI, Schema, Type } from "@google/genai";
import { AIResponse, ActionType, LogEntry } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING, description: "The text Aura will speak." },
    action: { type: Type.STRING, enum: ["OPEN_URL", "SEARCH", "NONE"] },
    value: { type: Type.STRING, description: "The URL or search term." }
  },
  required: ["message", "action", "value"]
};

const SYSTEM_INSTRUCTION = `
You are Aura, a helpful AI browser assistant. 
Return strictly valid JSON matching the schema. 
Actions:
- Open [Site]: action="OPEN_URL", value="https://..."
- Search [Query]: action="SEARCH", value="[Query]"
- Else: action="NONE", value=""
Keep 'message' short (under 15 words).
`;

// .env.local setup (Vite): create file at project root (same folder as package.json)
// VITE_GEMINI_API_KEY=<your-key-here>
// Do NOT commit .env.local, and avoid logging the raw key in production.
// Exposed variables across the frontend must start with VITE_ as required by Vite.
export const processUserMessage = async (input: string, history: LogEntry[]): Promise<AIResponse> => {
  try {
    // debug: check whether VITE_GEMINI_API_KEY is present, but do not print the key value in prod
    const hasKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    console.log("Gemini service env: key present?", hasKey);
    console.log("Gemini service env keys:", {
      VITE_GEMINI_API_KEY: hasKey ? "[REDACTED]" : "(missing)"
    });

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("Gemini API key is missing. Please add VITE_GEMINI_API_KEY to .env.local at project root.");
      return {
        message: "Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env.local and restart.",
        action: ActionType.NONE,
        value: ""
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format History for Memory - Mapping types correctly
    const historyText = history
      .map(h => `${h.type === 'user' ? 'User' : 'Aura'}: ${h.text}`)
      .join("\n");

    const fullPrompt = `Conversation History:\n${historyText}\n\nUser: ${input}`;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    });

    const responseText = result.text;
    if (!responseText) throw new Error("No response from Gemini");

    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed: AIResponse = JSON.parse(cleanedText);

    // Normalize URLs
    if (parsed.action === "OPEN_URL" && parsed.value) {
      let val = parsed.value.trim();
      if (val.toLowerCase().includes("youtube") && !val.includes("https")) {
        parsed.value = "https://www.youtube.com";
      } else if (!/^https?:\/\//i.test(val)) {
        parsed.value = `https://${val}`;
      }
    }

    return parsed;
  } catch (error) {
    console.error("Gemini Service Error:", error);
    return {
      message: "I encountered an error. Please check your connection.",
      action: ActionType.NONE,
      value: ""
    };
  }
};