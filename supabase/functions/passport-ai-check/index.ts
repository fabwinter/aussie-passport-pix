import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Jimp from "npm:jimp@0.22.12";

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

function base64ToBuffer(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function analysePassportPhoto(imageBytes: Uint8Array): Promise<CheckResult> {
  const reasons: string[] = [];

  const image = await Jimp.read(Buffer.from(imageBytes));
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data as Buffer;

  const ratio = width / height;
  const targetRatio = 7 / 9;
  if (Math.abs(ratio - targetRatio) > 0.025) {
    reasons.push(
      `Incorrect aspect ratio: current ratio is ${ratio.toFixed(3)} but Australian passport photos must be 35×45 mm (7:9 ratio = ${targetRatio.toFixed(3)}). Re-crop the photo to the correct dimensions.`
    );
  }

  if (width < 800 || height < 1000) {
    reasons.push(
      `Resolution too low: image is ${width}×${height} px. For quality printing at 35×45 mm, a minimum of 827×1063 px (600 DPI) is required. Upload a higher-resolution source photo.`
    );
  }

  const margin = Math.round(width * 0.04);
  const patch = 15;
  const cornerRegions = [
    { x: margin, y: margin, name: "top-left" },
    { x: width - margin - patch, y: margin, name: "top-right" },
    { x: margin, y: height - margin - patch, name: "bottom-left" },
    { x: width - margin - patch, y: height - margin - patch, name: "bottom-right" },
  ];

  const failingCorners: string[] = [];
  for (const { x, y, name } of cornerRegions) {
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
    if (total > 0 && brightCount / total < 0.85) {
      failingCorners.push(name);
    }
  }
  if (failingCorners.length > 0) {
    reasons.push(
      `Background not white in ${failingCorners.join(", ")} corner(s). Australian passport photos require a plain white background with no shadows or patterns. Re-run background removal or adjust lighting.`
    );
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height * 0.42);
  const rx = Math.floor(width * 0.28);
  const ry = Math.floor(height * 0.32);
  let totalLuma = 0;
  let facePixels = 0;
  let skinToneCount = 0;
  let darkPixelCount = 0;
  let brightPixelCount = 0;

  for (let row = cy - ry; row < cy + ry; row++) {
    for (let col = cx - rx; col < cx + rx; col++) {
      const dx = (col - cx) / rx;
      const dy = (row - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (row < 0 || row >= height || col < 0 || col >= width) continue;
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 240 && g > 240 && b > 240) continue;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;
      facePixels++;
      if (luma < 60) darkPixelCount++;
      if (luma > 230) brightPixelCount++;
      if (r > 90 && r > g && r > b && g > 40 && b < 200) skinToneCount++;
    }
  }

  if (facePixels > 100) {
    const avgLuma = totalLuma / facePixels;
    const darkRatio = darkPixelCount / facePixels;
    const brightRatio = brightPixelCount / facePixels;

    if (avgLuma < 60 || darkRatio > 0.3) {
      reasons.push(
        `Face area is too dark (average brightness: ${Math.round(avgLuma)}/255, ${Math.round(darkRatio * 100)}% dark pixels). Use even front-facing lighting or apply auto-correct in the Enhance step.`
      );
    } else if (avgLuma > 230 || brightRatio > 0.4) {
      reasons.push(
        `Face area is over-exposed (average brightness: ${Math.round(avgLuma)}/255). Reduce brightness in the Enhance step to avoid washed-out features.`
      );
    }

    if (skinToneCount / facePixels < 0.08 && avgLuma > 60) {
      reasons.push(
        `Little skin tone detected in face region. Ensure the subject's face is clearly visible and centred in the photo.`
      );
    }
  }

  let colourVarianceSum = 0;
  const sampleStep = Math.max(1, Math.floor((width * height) / 8000));
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 240 && g > 240 && b > 240) continue;
    colourVarianceSum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
    sampleCount++;
  }
  const avgVariance = sampleCount > 0 ? colourVarianceSum / sampleCount : 0;
  if (avgVariance < 5) {
    reasons.push(
      `Photo appears to be black and white or greyscale (colour variance score: ${avgVariance.toFixed(1)}). Australian passport photos must be in colour. Check that your source photo is a colour image.`
    );
  }

  const topZoneEnd = Math.floor(height * 0.08);
  let topLuma = 0;
  let topCount = 0;
  for (let row = 0; row < topZoneEnd; row++) {
    for (let col = Math.floor(width * 0.3); col < Math.floor(width * 0.7); col++) {
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      topLuma += 0.299 * r + 0.587 * g + 0.114 * b;
      topCount++;
    }
  }
  if (topCount > 0 && topLuma / topCount < 200) {
    reasons.push(
      `Top of frame may be obstructed or the head is positioned too low. The full head including hair must be visible with a small gap between the top of the head and the top of the photo.`
    );
  }

  const bottomFaceZoneStart = Math.floor(height * 0.65);
  const bottomFaceZoneEnd = Math.floor(height * 0.80);
  let chinLuma = 0;
  let chinCount = 0;
  for (let row = bottomFaceZoneStart; row < bottomFaceZoneEnd; row++) {
    for (let col = Math.floor(width * 0.35); col < Math.floor(width * 0.65); col++) {
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 230 && g > 230 && b > 230) continue;
      chinLuma += 0.299 * r + 0.587 * g + 0.114 * b;
      chinCount++;
    }
  }
  if (chinCount < 50) {
    reasons.push(
      `Chin or lower face appears to be cut off or missing. The full face from chin to crown must be visible in an Australian passport photo.`
    );
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

    const imageBytes = base64ToBuffer(body.image);
    const result = await analysePassportPhoto(imageBytes);

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
