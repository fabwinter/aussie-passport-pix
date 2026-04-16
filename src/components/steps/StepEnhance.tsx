import { useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, ArrowLeft, Wand as Wand2, SunMedium, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function SliderControl({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onValueChange: (v: number[]) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value.toFixed(2)}</span>
      </div>
      <div style={{ touchAction: "none" }}>
        <Slider
          value={[value]}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
        />
      </div>
    </div>
  );
}

export default function StepEnhance() {
  const {
    croppedImage, setEnhancedImage,
    brightness, setBrightness,
    contrast, setContrast,
    saturation, setSaturation,
    sharpness, setSharpness,
    advancedEnhanceVisible, setAdvancedEnhanceVisible,
    setCurrentStep,
  } = usePhoto();

  const [isAutoEnhancing, setIsAutoEnhancing] = useState(false);

  const previewFilter = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturation})`,
    sharpness > 1 ? `contrast(${(1 + (sharpness - 1) * 0.12).toFixed(3)})` : "",
  ].filter(Boolean).join(" ");

  const autoEnhance = useCallback(() => {
    if (!croppedImage) return;
    setIsAutoEnhancing(true);
    const img = new Image();
    img.onload = () => {
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

      const avgLuma = totalLuma / pixelCount;
      const avgSat = totalSat / pixelCount;
      const range = maxLuma - minLuma;

      const targetLuma = 160;
      const newBrightness = parseFloat(
        Math.min(Math.max(targetLuma / Math.max(avgLuma, 1), 0.8), 1.6).toFixed(2)
      );

      const targetRange = 180;
      const newContrast = parseFloat(
        (range < targetRange
          ? Math.min(1.0 + (targetRange - range) / 255, 1.5)
          : 1.0
        ).toFixed(2)
      );

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
      setSharpness(1.30);
      setIsAutoEnhancing(false);
      toast.success("Auto correction applied for passport photo standards.");
    };
    img.onerror = () => setIsAutoEnhancing(false);
    img.src = croppedImage;
  }, [croppedImage, setBrightness, setContrast, setSaturation, setSharpness]);

  const reduceShadows = useCallback(() => {
    if (!croppedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma < 100) {
          const boost = ((100 - luma) / 100) * 40;
          data[i] = Math.min(255, r + boost);
          data[i + 1] = Math.min(255, g + boost);
          data[i + 2] = Math.min(255, b + boost);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setEnhancedImage(canvas.toDataURL("image/jpeg", 0.95));
      toast.success("Facial shadows softened.");
    };
    img.src = croppedImage;
  }, [croppedImage, setEnhancedImage]);

  const saveAndContinue = useCallback(() => {
    if (!croppedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
      ctx.drawImage(img, 0, 0);

      if (sharpness > 1) {
        ctx.globalAlpha = (sharpness - 1) * 0.3;
        ctx.filter = `brightness(${brightness}) contrast(${(contrast + 0.3).toFixed(3)}) saturate(${saturation})`;
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 1;
      }

      ctx.filter = "none";

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const margin = Math.round(canvas.width * 0.06);
      for (let row = 0; row < margin; row++) {
        for (let col = 0; col < canvas.width; col++) {
          const i = (row * canvas.width + col) * 4;
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
          }
        }
      }
      for (let row = canvas.height - margin; row < canvas.height; row++) {
        for (let col = 0; col < canvas.width; col++) {
          const i = (row * canvas.width + col) * 4;
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
          }
        }
      }
      for (let row = 0; row < canvas.height; row++) {
        for (let col = 0; col < margin; col++) {
          const i = (row * canvas.width + col) * 4;
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
          }
        }
        for (let col = canvas.width - margin; col < canvas.width; col++) {
          const i = (row * canvas.width + col) * 4;
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);

      setEnhancedImage(canvas.toDataURL("image/jpeg", 0.97));
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
      <div className="rounded-xl border bg-card shadow-sm p-8 text-center text-muted-foreground text-sm">
        Complete cropping first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Lighting Enhancement</h2>
        <p className="text-xs text-muted-foreground">Adjust brightness and contrast for passport standards</p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 flex justify-center p-6">
          <img
            src={croppedImage}
            alt="Enhanced preview"
            style={{ filter: previewFilter }}
            className="max-h-64 rounded-lg shadow-sm object-contain"
          />
        </div>
      </div>

      <div className="flex justify-center gap-2.5 flex-wrap">
        <Button
          variant="outline"
          onClick={autoEnhance}
          disabled={isAutoEnhancing}
          className="gap-2"
        >
          <Wand2 className="w-4 h-4" />
          {isAutoEnhancing ? "Analysing..." : "Auto Correct"}
        </Button>
        <Button
          variant="outline"
          onClick={reduceShadows}
          className="gap-2"
        >
          <SunMedium className="w-4 h-4" />
          Soften Shadows
        </Button>
        <Button
          variant="outline"
          onClick={resetDefaults}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg border px-4 py-2.5"
        onClick={() => setAdvancedEnhanceVisible(!advancedEnhanceVisible)}
      >
        <span>Manual adjustment sliders</span>
        {advancedEnhanceVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {advancedEnhanceVisible && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <SliderControl
            label="Brightness"
            value={brightness}
            onValueChange={([v]) => setBrightness(v)}
            min={0.5} max={2} step={0.05}
          />
          <SliderControl
            label="Contrast"
            value={contrast}
            onValueChange={([v]) => setContrast(v)}
            min={0.5} max={2} step={0.05}
          />
          <SliderControl
            label="Saturation"
            value={saturation}
            onValueChange={([v]) => setSaturation(v)}
            min={0} max={2} step={0.05}
          />
          <SliderControl
            label="Sharpness"
            value={sharpness}
            onValueChange={([v]) => setSharpness(v)}
            min={0.5} max={3} step={0.05}
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-2.5">
        <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={saveAndContinue} className="gap-1">
          Continue <span className="hidden sm:inline">to Compliance</span> &rarr;
        </Button>
      </div>
    </div>
  );
}
