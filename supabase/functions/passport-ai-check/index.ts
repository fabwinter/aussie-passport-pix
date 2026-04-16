import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckRequest {
  image: string;
  country?: string;
}

interface CheckResult {
  pass: boolean;
  reasons: string[];
}

async function dataUrlToImageData(dataUrl: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: bitmap.width, height: bitmap.height, data: imageData.data };
}

function analyseImage(width: number, height: number, data: Uint8ClampedArray): CheckResult {
  const reasons: string[] = [];

  const ratio = width / height;
  const targetRatio = 7 / 9;
  if (Math.abs(ratio - targetRatio) > 0.025) {
    reasons.push(`Aspect ratio is ${ratio.toFixed(2)} — expected 7:9 (${targetRatio.toFixed(2)}). Re-crop the photo.`);
  }

  if (width < 800 || height < 1000) {
    reasons.push(`Resolution ${width}×${height} px may be too low for high-quality printing. Aim for at least 827×1063 px.`);
  }

  const margin = Math.round(width * 0.04);
  const patch = 15;
  const cornerRegions = [
    { x: margin, y: margin },
    { x: width - margin - patch, y: margin },
    { x: margin, y: height - margin - patch },
    { x: width - margin - patch, y: height - margin - patch },
  ];

  let nonWhiteCorners = 0;
  for (const { x, y } of cornerRegions) {
    let brightCount = 0;
    let total = 0;
    for (let row = y; row < Math.min(y + patch, height); row++) {
      for (let col = x; col < Math.min(x + patch, width); col++) {
        const idx = (row * width + col) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 210 && g > 210 && b > 210) brightCount++;
        total++;
      }
    }
    if (total > 0 && brightCount / total < 0.9) nonWhiteCorners++;
  }
  if (nonWhiteCorners > 0) {
    reasons.push("Background does not appear uniformly white in all corners. Ensure the background is plain white.");
  }

  let totalLuma = 0;
  let facePixels = 0;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height * 0.45);
  const rx = Math.floor(width * 0.25);
  const ry = Math.floor(height * 0.30);
  for (let row = cy - ry; row < cy + ry; row++) {
    for (let col = cx - rx; col < cx + rx; col++) {
      const dx = (col - cx) / rx;
      const dy = (row - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (row < 0 || row >= height || col < 0 || col >= width) continue;
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 240 && g > 240 && b > 240) continue;
      totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
      facePixels++;
    }
  }

  if (facePixels > 0) {
    const avgLuma = totalLuma / facePixels;
    if (avgLuma < 70) {
      reasons.push("Face area appears too dark. Try better lighting or use 'Auto Correct Lighting' in the Enhance step.");
    } else if (avgLuma > 220) {
      reasons.push("Face area appears over-exposed or washed out. Reduce brightness in the Enhance step.");
    }
  }

  let colourVariance = 0;
  const sampleStep = Math.max(1, Math.floor((width * height) / 5000));
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 240 && g > 240 && b > 240) continue;
    colourVariance += Math.abs(r - g) + Math.abs(g - b);
    sampleCount++;
  }
  const avgVariance = sampleCount > 0 ? colourVariance / sampleCount : 0;
  if (avgVariance < 4) {
    reasons.push("Photo appears to be black and white or greyscale. Australian passports require a colour photo.");
  }

  const topThirdEnd = Math.floor(height * 0.12);
  let topEdgeLuma = 0;
  let topEdgeCount = 0;
  for (let row = 0; row < topThirdEnd; row++) {
    for (let col = Math.floor(width * 0.3); col < Math.floor(width * 0.7); col++) {
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      topEdgeLuma += 0.299 * r + 0.587 * g + 0.114 * b;
      topEdgeCount++;
    }
  }
  if (topEdgeCount > 0 && topEdgeLuma / topEdgeCount < 180) {
    reasons.push("Head may be positioned too low or the top of the head may be cut off. Ensure the full head is visible.");
  }

  return { pass: reasons.length === 0, reasons };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CheckRequest = await req.json();
    if (!body.image) {
      return new Response(JSON.stringify({ error: "Missing image field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { width, height, data } = await dataUrlToImageData(body.image);
    const result = analyseImage(width, height, data);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("passport-ai-check error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
