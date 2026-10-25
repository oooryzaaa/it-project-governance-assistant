"use strict";

const { GoogleGenAI } = require("@google/genai");

async function callLLM(prompt, env = process.env) {
  const apiKey = env.GEMINI_API_KEY;
  const modelName = env.GEMINI_MODEL;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi di file .env");
  }
  if (!modelName) {
    throw new Error("GEMINI_MODEL tidak dikonfigurasi di file .env");
  }

  const genai = new GoogleGenAI({ apiKey });
  const response = await genai.models.generateContent({ model: modelName, contents: prompt });
  const text = response.text;
  if (!text) throw new Error("LLM mengembalikan respons kosong");
  return text;
}

module.exports = { callLLM };
