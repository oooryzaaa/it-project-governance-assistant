"use strict";

const path = require("node:path");
const express = require("express");
const { getKnownCobitCodes } = require("./cobit-data");
const { buildPrompt, parseModelResponse, validateRequestBody, validateSchema } = require("./server/generation");
const { callLLM } = require("./server/gemini-service");
const { isPublicAssetPath } = require("./server/public-assets");

function safeReason(error) {
  let reason = error instanceof Error ? error.message : "Layanan AI tidak tersedia";
  const secret = process.env.GEMINI_API_KEY;
  if (secret) reason = reason.split(secret).join("[redacted]");
  return reason.slice(0, 300);
}

function createApp({ generate = callLLM } = {}) {
  const app = express();
  const publicRoot = __dirname;
  const staticMiddleware = express.static(publicRoot, {
    dotfiles: "deny",
    index: false,
    fallthrough: false,
  });

  app.use(express.json({ limit: "64kb" }));
  app.get("/", (_req, res) => res.sendFile(path.join(publicRoot, "index.html")));
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || !isPublicAssetPath(req.path)) return next();
    return staticMiddleware(req, res, next);
  });

  app.post("/api/generate", async (req, res) => {
    let cleanData;
    try {
      cleanData = validateRequestBody(req.body);
    } catch (error) {
      return res.status(400).json({ error: safeReason(error) });
    }

    let rawText;
    try {
      rawText = await generate(buildPrompt(cleanData));
    } catch (error) {
      console.error("[LLM Error] AI generation failed");
      return res.status(200).json({ fallback: true, reason: safeReason(error) });
    }

    let parsed;
    try {
      parsed = parseModelResponse(rawText);
    } catch (_error) {
      console.error("[JSON Parse Error] Model response was invalid");
      return res.status(200).json({ fallback: true, reason: "LLM mengembalikan JSON tidak valid" });
    }

    try {
      validateSchema(parsed);
    } catch (error) {
      console.error("[Schema Error] Model response did not match the required schema");
      return res.status(200).json({ fallback: true, reason: safeReason(error) });
    }

    const knownCodes = getKnownCobitCodes();
    if (Array.isArray(parsed.cobit_mappings)) {
      parsed.cobit_mappings = parsed.cobit_mappings.map((mapping) => ({
        ...mapping,
        unknown: knownCodes.size > 0 && !knownCodes.has(mapping.code),
      }));
    }
    return res.status(200).json({ success: true, data: parsed });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: "AI", timestamp: new Date().toISOString() });
  });

  app.use((error, _req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "JSON request body tidak valid" });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ error: "Ukuran request melebihi batas 64kb" });
    }
    if (res.headersSent) return next(error);
    console.error("[HTTP Error] Request could not be completed");
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  });

  return app;
}

if (require.main === module) {
  require("dotenv").config();
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`IT Project Governance Assistant berjalan di http://localhost:${port}`);
    console.log(`Model LLM  : ${process.env.GEMINI_MODEL || "(belum dikonfigurasi)"}`);
  });
}

module.exports = {
  createApp,
  safeReason,
  buildPrompt,
  parseModelResponse,
  validateRequestBody,
  validateSchema,
};
