// app/api/plushy/route.js
export const runtime = "edge";

/** Simple helper for consistent JSON + CORS */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
    },
  });
}

/** Handle preflight CORS requests */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

/** Main POST endpoint */
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file"); // user-uploaded logo
    const bg = form.get("bg") || "#EAF2FF";
    const size = "1024x1024";

    if (!file) return new Response("No file uploaded", { status: 400 });

    // 1️⃣ Fetch your hosted style reference
    const styleURL = "https://plushy-generator.vercel.app/material_reference_2.jpeg";
    const styleBlob = await fetch(styleURL).then((r) => {
      if (!r.ok) throw new Error("Could not fetch style reference");
      return r.blob();
    });

    // 2️⃣ Build prompt
    const prompt = `
Combine the style of the first image (a soft plush, ribbed-knit coral material)
with the uploaded logo. 
Create a plush speech-bubble pillow with a small tail, made of bright coral ribbed fabric.
Place the logo as a white chenille patch centered on the front.
Make it appear as a soft, floating object with no ground shadow.
Use a gentle ${bg} background. 
Photorealistic textile detail, soft studio lighting, subtle depth-of-field, 1024x1024.
Do not add extra text, watermarks, or background clutter.`;

    // 3️⃣ Prepare request to OpenAI Images API
    const body = new FormData();
    body.append("model", "gpt-image-1");

    // always include style first
    body.append("image", styleBlob, "style.jpeg");
    // then the user logo
    body.append("image", file, "logo.png");

    body.append("prompt", prompt);
    body.append("size", size);

    // 4️⃣ Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(text || "OpenAI error", { status: response.status });
    }

    const jsonResponse = await response.json();
    const b64 = jsonResponse?.data?.[0]?.b64_json;
    if (!b64) return new Response("No image returned", { status: 502 });

    return json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    return new Response(err?.message || "Server error", { status: 500 });
  }
}
