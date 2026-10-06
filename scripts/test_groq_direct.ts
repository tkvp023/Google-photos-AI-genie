import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function test() {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  console.log("Key exists:", Boolean(key), "Key length:", key?.length, "Model:", model);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Say hello in json: {\"msg\": \"hello\"}" }],
        response_format: { type: "json_object" }
      })
    });
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Body:", text);
  } catch (err: any) {
    console.error("Fetch error:", err);
  }
}

test();
