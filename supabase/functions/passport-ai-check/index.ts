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

interface CheckItem {
  label: string;
  pass: boolean;
  detail: string;
  fix?: string;
}

interface CheckResult {
  pass: boolean;
  checks: CheckItem[];
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
  const checks: CheckItem[] = [];

  const image = await Jimp.read(Buffer.from(imageBytes));
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data as Buffer;

  // 1. Aspect ratio
  const ratio = width / height;
  const targetRatio = 7 / 9;
  const ratioOk = Math.abs(ratio - targetRatio) <= 0.025;
  checks.push({
    label: "Correct aspect ratio (35×45 mm / 7:9)",
    pass: ratioOk,
    detail: ratioOk
      ? `Aspect ratio is ${ratio.toFixed(3)} — within the required 7:9 (${targetRatio.toFixed(3)}) tolerance.`
      : `Aspect ratio is ${ratio.toFixed(3)} but must be 7:9 (${targetRatio.toFixed(3)}) for a 35×45 mm Australian passport photo.`,
    fix: ratioOk ? undefined : "Re-crop the photo to the correct 7:9 ratio in the Crop step.",
  });

  // 2. Resolution
  const resOk = width >= 800 && height >= 1000;
  checks.push({
    label: "Sufficient resolution (≥ 600 DPI / 827×1063 px)",
    pass: resOk,
    detail: resOk
      ? `Resolution is ${width}×${height} px — sufficient for quality printing at 35×45 mm.`
      : `Resolution is ${width}×${height} px, below the minimum 827×1063 px needed for 600 DPI printing.`,
    fix: resOk ? undefined : "Upload a higher-resolution source photo (at least 800×1000 px).",
  });

  // 3. Neutral/white background — corners must be light (≥165/255 each channel)
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
    let lightCount = 0;
    let total = 0;
    for (let row = y; row < Math.min(y + patch, height); row++) {
      for (let col = x; col < Math.min(x + patch, width); col++) {
        const idx = (row * width + col) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        // Accept white or light grey (neutral background)
        if (r > 165 && g > 165 && b > 165) lightCount++;
        total++;
      }
    }
    if (total > 0 && lightCount / total < 0.75) {
      failingCorners.push(name);
    }
  }
  const bgOk = failingCorners.length === 0;
  checks.push({
    label: "Plain white or light grey background",
    pass: bgOk,
    detail: bgOk
      ? "Background corners appear white or light neutral — meets Australian passport requirements."
      : `Background appears dark or coloured in the ${failingCorners.join(", ")} corner(s). Australian passports require a plain white or light grey background.`,
    fix: bgOk ? undefined : "Re-run background removal or ensure you are photographed against a plain light background.",
  });

  // 4. Face brightness / lighting
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height * 0.42);
  const rx = Math.floor(width * 0.28);
  const ry = Math.floor(height * 0.32);
  let totalLuma = 0;
  let facePixels = 0;
  let darkPixelCount = 0;
  let brightPixelCount = 0;
  let skinToneCount = 0;

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
      checks.push({
        label: "Even face lighting",
        pass: false,
        detail: `Face area is too dark (avg brightness ${Math.round(avgLuma)}/255, ${Math.round(darkRatio * 100)}% dark pixels). Shadows obscure facial features.`,
        fix: "Use even, diffuse lighting from the front. Avoid shadows. Adjust brightness in the Enhance step.",
      });
    } else if (avgLuma > 230 || brightRatio > 0.4) {
      checks.push({
        label: "Even face lighting",
        pass: false,
        detail: `Face area is over-exposed (avg brightness ${Math.round(avgLuma)}/255, ${Math.round(brightRatio * 100)}% blown-out pixels). Features may not be clearly visible.`,
        fix: "Reduce brightness in the Enhance step to avoid washed-out features.",
      });
    } else {
      checks.push({
        label: "Even face lighting",
        pass: true,
        detail: `Face brightness is ${Math.round(avgLuma)}/255 — well-lit with no significant shadows or over-exposure.`,
      });
    }

    // 5. Face visible / skin tone
    const skinRatio = skinToneCount / facePixels;
    const faceVisibleOk = skinRatio >= 0.06 || avgLuma < 80;
    checks.push({
      label: "Face clearly visible and centred",
      pass: faceVisibleOk,
      detail: faceVisibleOk
        ? "Face appears visible and centred within the frame."
        : `Low skin-tone pixel ratio (${(skinRatio * 100).toFixed(1)}%) in the expected face region. The face may not be centred or may be partially obscured.`,
      fix: faceVisibleOk ? undefined : "Ensure the subject's face is centred in the photo, looking directly at the camera with no obstructions.",
    });
  }

  // 6. Colour photo check
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
  const colourOk = avgVariance >= 5;
  checks.push({
    label: "Colour photograph",
    pass: colourOk,
    detail: colourOk
      ? `Photo is in colour (colour variance score: ${avgVariance.toFixed(1)}).`
      : `Photo appears greyscale or black-and-white (colour variance score: ${avgVariance.toFixed(1)}). Australian passport photos must be in colour.`,
    fix: colourOk ? undefined : "Ensure your source photo is a colour image. Check the Saturation slider in the Enhance step.",
  });

  // 7. Top of head visible
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
  const topOk = topCount === 0 || topLuma / topCount >= 190;
  checks.push({
    label: "Full head visible (crown to chin)",
    pass: topOk,
    detail: topOk
      ? "Top of frame appears clear — head crown is visible with adequate spacing."
      : "Top of frame appears dark, suggesting the head may be positioned too low or the crown is cut off.",
    fix: topOk ? undefined : "Re-crop so the full head including hair is visible, with a small gap at the top of the frame.",
  });

  // 8. Chin visible
  const chinZoneStart = Math.floor(height * 0.65);
  const chinZoneEnd = Math.floor(height * 0.80);
  let chinCount = 0;
  for (let row = chinZoneStart; row < chinZoneEnd; row++) {
    for (let col = Math.floor(width * 0.35); col < Math.floor(width * 0.65); col++) {
      const idx = (row * width + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 230 && g > 230 && b > 230) continue;
      chinCount++;
    }
  }
  const chinOk = chinCount >= 50;
  checks.push({
    label: "Chin and lower face visible",
    pass: chinOk,
    detail: chinOk
      ? "Chin and lower face appear visible in the expected region."
      : "Chin or lower face may be cut off or missing from the frame.",
    fix: chinOk ? undefined : "Re-crop to ensure the full face from chin to crown is included in the photo.",
  });

  const allPass = checks.every((c) => c.pass);
  return { pass: allPass, checks };
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
