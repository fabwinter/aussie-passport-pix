import { useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sun, RotateCcw, ArrowLeft, Wand2 } from "lucide-react";
import { toast } from "sonner";

export default function StepEnhance() {
  const {
    croppedImage, setEnhancedImage,
    brightness, setBrightness,
    contrast, setContrast,
    saturation, setSaturation,
    sharpness, setSharpness,
    setCurrentStep,
  } = usePhoto();

  const [isAutoEnhancing, setIsAutoEnhancing] = useState(false);

  // Live preview via CSS filter — guaranteed to respond to every slider move
  const previewFilter = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturation})`,
    // Approximate sharpness visually with a slight extra contrast boost
    sharpness > 1 ? `contrast(${(1 + (sharpness - 1) * 0.12).toFixed(3)})` : "",
  ].filter(Boolean).join(" ");

  const autoEnhance = useCallback(() => {
    if (!croppedImage) return;
    setIsAutoEnhancing(true);
    const img = new Image();
    img.onload = () => {
      // Sample at reduced size for speed
      const sampleW = Math.min(img.width, 200);
      const sampleH = Math.round(sampleW * (img.height / img.width));
      const canvas = document.createElement("canvas");
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, sampleW, sampleH);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

      let totalLuma = 0, totalSat = 0;
      let minLuma = 255, maxLuma = 0;
      let pixelCount = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Ignore near-white background pixels produced by bg-removal
        if (r > 240 && g > 240 && b > 240) continue;

        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuma += luma;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);

        const cMax = Math.max(r, g, b);
        const cMin = Math.min(r, g, b);
        totalSat += cMax === 0 ? 0 : (cMax - cMin) / cMax;
        pixelCount++;
      }

      if (pixelCount === 0) { setIsAutoEnhancing(false); return; }

      const avgLuma = totalLuma / pixelCount;        // 0–255
      const avgSat  = totalSat  / pixelCount;        // 0–1
      const range   = maxLuma - minLuma;             // 0–255

      // Target face luma ~160/255 (well-lit, not blown-out)
      const targetLuma = 160;
      const newBrightness = parseFloat(
        Math.min(Math.max(targetLuma / Math.max(avgLuma, 1), 0.8), 1.6).toFixed(2)
      );

      // Stretch contrast toward a tonal range of ~180/255
      const targetRange = 180;
      const newContrast = parseFloat(
        (range < targetRange
          ? Math.min(1.0 + (targetRange - range) / 255, 1.5)
          : 1.0
        ).toFixed(2)
      );

      // Natural skin saturation sits around 0.18–0.25; boost if flat, reduce if garish
      const targetSat = 0.22;
      const newSaturation = parseFloat(
        (avgSat < targetSat
          ? Math.min(1.0 + (targetSat - avgSat) * 4, 1.4)
          : avgSat > 0.40
          ? Math.max(1.0 - (avgSat - 0.40) * 1.5, 0.8)
          : 1.0
        ).toFixed(2)
      );

      setBrightness(newBrightness);
      setContrast(newContrast);
      setSaturation(newSaturation);
      setSharpness(1.30); // Standard passport sharpening
      setIsAutoEnhancing(false);
      toast.success("Auto enhancement applied for passport photo standards.");
    };
    img.onerror = () => setIsAutoEnhancing(false);
    img.src = croppedImage;
  }, [croppedImage, setBrightness, setContrast, setSaturation, setSharpness]);

  const saveAndContinue = useCallback(() => {
    if (!croppedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Primary pass — brightness + contrast + saturation
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
      ctx.drawImage(img, 0, 0);

      // Sharpening overlay (unsharp-mask simulation)
      if (sharpness > 1) {
        ctx.globalAlpha = (sharpness - 1) * 0.3;
        ctx.filter = `brightness(${brightness}) contrast(${(contrast + 0.3).toFixed(3)}) saturate(${saturation})`;
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 1;
        ctx.filter = "none";
      }

      setEnhancedImage(canvas.toDataURL("image/jpeg", 0.95));
      setCurrentStep(5);
    };
    img.src = croppedImage;
  }, [croppedImage, brightness, contrast, saturation, sharpness, setEnhancedImage, setCurrentStep]);

  const resetDefaults = () => {
    setBrightness(1.15);
    setContrast(1.10);
    setSaturation(1.0);
    setSharpness(1.30);
  };

  if (!croppedImage) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Complete cropping first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Lighting Enhancement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CSS filter on <img> — updates instantly on every slider change */}
        <div className="flex justify-center">
          <img
            src={croppedImage}
            alt="Enhanced preview"
            style={{ filter: previewFilter }}
            className="max-h-72 rounded-lg border shadow-sm object-contain"
          />
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={autoEnhance}
            disabled={isAutoEnhancing}
            className="gap-2"
          >
            <Wand2 className="w-4 h-4" />
            {isAutoEnhancing ? "Analysing…" : "Auto Enhance"}
          </Button>
        </div>

        <div className="space-y-4 max-w-md mx-auto">
          <SliderControl label="Brightness" value={brightness} onChange={setBrightness} min={0.5} max={2} step={0.05} />
          <SliderControl label="Contrast"   value={contrast}   onChange={setContrast}   min={0.5} max={2} step={0.05} />
          <SliderControl label="Saturation" value={saturation} onChange={setSaturation} min={0}   max={2} step={0.05} />
          <SliderControl label="Sharpness"  value={sharpness}  onChange={setSharpness}  min={0.5} max={3} step={0.05} />
        </div>

        <div className="flex justify-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button variant="outline" onClick={resetDefaults} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button onClick={saveAndContinue}>
            Continue to Compliance →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SliderControl({
  label, value, onChange, min, max, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
