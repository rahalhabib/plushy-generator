export const runtime = "edge";

function okJSON(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
    },
  });
}

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

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const bg = form.get("bg") || "#EAF2FF";
    const size = form.get("size") || "1920x1080";

    if (!file) return new Response("No file", { status: 400 });

    const prompt = `
Create a soft plush speech-bubble pillow (rounded square with a small tail).
Ribbed knit fabric in bright coral. Place the uploaded logo as a white chenille
patch centered on the front, slightly raised, clean edges. The object FLOATS
(no ground shadow). Pale blue background ${bg}. Format ${size}, 16:9 composition.
Soft studio lighting, gentle depth-of-field (background slightly blurred),
logo crisp. Photoreal textile detail (fine ribbing, soft fibers).
Do not add any extra text or watermarks.`;

    const body = new FormData();
    body.append("model", "gpt-image-1");
    body.append("image", file);      // use uploaded logo as reference
    body.append("prompt", prompt);
    body.append("size", size);

    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
    });

    if (!r.ok) return new Response(await r.text(), { status: r.status });
    const json = await r.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return new Response("No image returned", { status: 502 });

    return okJSON({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    return new Response(e?.message || "Server error", { status: 500 });
  }
}
