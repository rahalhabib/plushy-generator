// app/api/plushy/route.js
export const runtime = "nodejs";     // switch from edge → node
export const maxDuration = 60;       // allow more time (plan-dependent)

import fs from "node:fs/promises";
import path from "node:path";

/** JSON + CORS helper */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

export async function OPTIONS() {
  return json({}, 204);
}

export async function POST(req) {
  let abort;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const bg = form.get("bg") || "#EAF2FF";
    const size = "1024x1024";

    if (!file) return new Response("No file uploaded", { status: 400 });

    // 1) Load style reference from /public (no extra HTTP request)
    const stylePath = path.join(process.cwd(), "public", "material_reference_2.jpeg");
    const styleBuffer = await fs.readFile(stylePath);
    const styleBlob = new Blob([styleBuffer], { type: "image/jpeg" });

    // 2) Prompt
    const prompt = `
Combine the visual style of the first image (soft plush, ribbed-knit coral material)
with the uploaded logo.
Create a plush speech-bubble pillow (rounded square with a small tail), bright coral knit.
Place the logo as a white chenille patch centered on the front.
Floating object (no ground shadow). Gentle ${bg} background.
Photoreal textile detail, soft studio lighting, subtle depth-of-field. ${size}.
No extra text or watermarks.`;

    // 3) Build form data for OpenAI (use image[] for multiple files)
    const body = new FormData();
    body.append("model", "gpt-image-1");
    body.append("image[]", styleBlob, "style.jpeg");  // reference first
    body.append("image[]", file, "logo.png");         // user logo second
    body.append("prompt", prompt);
    body.append("size", size);

    // 4) Call OpenAI with a safety timeout (abort at ~55s)
    const controller = new AbortController();
    abort = setTimeout(() => controller.abort(), 55_000);

    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
      signal: controller.signal,
    });

    clearTimeout(abort);

    if (!r.ok) {
      const text = await r.text();
      if (r.status === 403) {
        return json({
          error: "OpenAI access denied",
          hint: "Verify your organization, ensure billing is set, and use a Project API key with access to gpt-image-1.",
          details: text
        }, 403);
      }
      return new Response(text || "OpenAI error", { status: r.status });
    }

    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return new Response("No image returned", { status: 502 });

    return json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    if (abort) clearTimeout(abort);
    if (err?.name === "AbortError") {
      return json({ error: "Generation took too long and was aborted. Try again." }, 504);
    }
    return new Response(err?.message || "Server error", { status: 500 });
  }
}
