import type { SuitabilityAssessment } from "@/context/PhotoContext";

export function assessSuitability(dataUrl: string): Promise<SuitabilityAssessment> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;

      let totalLuma = 0;
      let pixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuma += luma;
        pixels++;
      }
      const avgLuma = totalLuma / Math.max(pixels, 1);

      const reasons: string[] = [];
      if (avgLuma < 80) reasons.push("Photo appears quite dark — try brighter, even lighting.");
      if (avgLuma > 210) reasons.push("Photo appears very bright or over-exposed — avoid harsh direct light.");
      if (img.width < 600 || img.height < 600) reasons.push("Resolution may be too low — use at least 800 × 1000 px for best results.");

      resolve({ ok: reasons.length === 0, reasons });
    };
    img.onerror = () =>
      resolve({ ok: false, reasons: ["Could not analyse image for suitability."] });
    img.src = dataUrl;
  });
}
