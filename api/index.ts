import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { Groq } from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Helper to clean JSON from AI responses (handles markdown blocks)
function cleanJsonResponse(text: string): string {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

// --- Debug & Health Endpoints ---
app.get("/api/debug", (req, res) => {
  res.json({
    status: "ok",
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      HAS_GEMINI_KEY: !!process.env.GEMINI_API_KEY,
      HAS_GROQ_KEY: !!process.env.GROQ_API_KEY,
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
      HAS_ANTHROPIC_KEY: !!process.env.ANTHROPIC_API_KEY,
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- Computational Provider Endpoints ---
app.post("/api/ai/proxy", async (req, res) => {
  const { provider, apiKey: clientApiKey, prompt } = req.body;
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Proxy Request: ${provider}`);

  try {
    if (provider === "OpenAI") {
      const apiKey = clientApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(400).json({ error: "OpenAI API Key missing." });
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = cleanJsonResponse(response.choices[0].message.content || "{}");
      return res.json(JSON.parse(content));
    }
    if (provider === "Anthropic") {
      const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(400).json({ error: "Anthropic API Key missing." });
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt + "\n\nRespond ONLY with a valid JSON object." }],
      });
      const content = response.content[0].type === 'text' ? response.content[0].text : "";
      return res.json(JSON.parse(cleanJsonResponse(content)));
    }
    if (provider === "Groq") {
      const apiKey = clientApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error(`[${requestId}] Groq Error: API Key missing`);
        return res.status(400).json({ error: "Groq API Key missing. Please check your Vercel environment variables." });
      }
      
      const groq = new Groq({ apiKey });
      try {
        // llama-3.1-8b-instant is much faster than 70b and less likely to hit Vercel's 10s timeout
        const response = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a biological data assistant. Respond ONLY with valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
        });
        const content = cleanJsonResponse(response.choices[0].message.content || "{}");
        return res.json(JSON.parse(content));
      } catch (groqError: any) {
        console.error(`[${requestId}] Groq API Error:`, groqError);
        return res.status(502).json({ 
          error: `Groq API Error: ${groqError.message}`,
          details: groqError.response?.data || groqError.stack
        });
      }
    }
    res.status(400).json({ error: `Provider ${provider} not supported.` });
  } catch (error: any) {
    console.error(`[${requestId}] Global Proxy Error:`, error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message,
      requestId 
    });
  }
});

async function startServer() {
  const PORT = process.env.PORT || 3000;
  const isDev = process.env.NODE_ENV === "development";

  // --- Static Files & Vite Integration ---
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve from dist folder
    // When running in Vercel as a function, dist is in the parent directory
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("/*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running in ${isDev ? 'development' : 'production'} mode on port ${PORT}`);
  });
}

// START SERVER
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Server startup failed:', err);
    process.exit(1);
  });
}

export default app;
