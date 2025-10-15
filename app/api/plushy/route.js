// app/api/plushy/route.js
export const runtime = "edge";

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
  try {
    const form = await req.formData();
    const file = form.get("file"); // user-uploaded logo (File)
    const bg = form.get("bg") || "#EAF2FF";
    const size = "1024x1024";

    if (!file) return new Response("No file uploaded", { status: 400 });

    // Build absolute URL to your style reference hosted in /public
    const { origin } = new URL(req.url);
    const styleURL = `${origin}/material_reference_2.jpeg`;

    // Fetch style reference as Blob
    const styleRes = await fetch(styleURL);
    if (!styleRes.ok) return new Response("Style reference not found", { status: 500 });
    const styleBlob = await styleRes.blob();

    const prompt = `
Combine the visual style of the first image (soft plush, ribbed-knit coral material)
with the uploaded logo.
Output a plush speech-bubble pillow (rounded square with a small tail), bright coral knit.
Place the logo as a white chenille patch centered on the front.
Floating object (no ground shadow). Gentle ${bg} background.
Photoreal textile detail, soft studio lighting, subtle depth-of-field. ${size}.
No extra text or watermarks.`;

    // IMPORTANT: Use array syntax "image[]" for multiple images
    const body = new FormData();
    body.append("model", "gpt-image-1");
    body.append("image[]", styleBlob, "style.jpeg"); // style reference first
    body.append("image[]", file, "logo.png");        // then the user logo
    body.append("prompt", prompt);
    body.append("size", size);

    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(text || "OpenAI error", { status: r.status });
    }

    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return new Response("No image returned", { status: 502 });

    return json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    return new Response(err?.message || "Server error", { status: 500 });
  }
}
