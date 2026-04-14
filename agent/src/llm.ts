import OpenAI from "openai";
import "dotenv/config";

export const llm = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
