import { useEffect, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sun, RotateCcw } from "lucide-react";

export default function StepEnhance() {
  const {
    croppedImage, enhancedImage, setEnhancedImage,
    brightness, setBrightness,
    contrast, setContrast,
    sharpness, setSharpness,
    setCurrentStep,
  } = usePhoto();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const applyEnhancements = useCallback(() => {
    if (!croppedImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
      ctx.drawImage(img, 0, 0);

      // Simple unsharp mask simulation via overlay
      if (sharpness > 1) {
        ctx.globalAlpha = (sharpness - 1) * 0.3;
        ctx.filter = `brightness(${brightness}) contrast(${contrast + 0.3})`;
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 1;
        ctx.filter = "none";
      }

      setEnhancedImage(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.src = croppedImage;
  }, [croppedImage, brightness, contrast, sharpness, setEnhancedImage]);

  useEffect(() => {
    applyEnhancements();
  }, [applyEnhancements]);

  const resetDefaults = () => {
    setBrightness(1.15);
    setContrast(1.10);
    setSharpness(1.30);
  };

  if (!croppedImage) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Complete cropping first.</CardContent></Card>
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
        <div className="flex justify-center">
          <canvas ref={canvasRef} className="max-h-72 rounded-lg border shadow-sm" />
        </div>

        <div className="space-y-4 max-w-md mx-auto">
          <SliderControl label="Brightness" value={brightness} onChange={setBrightness} min={0.5} max={2} step={0.05} />
          <SliderControl label="Contrast" value={contrast} onChange={setContrast} min={0.5} max={2} step={0.05} />
          <SliderControl label="Sharpness" value={sharpness} onChange={setSharpness} min={0.5} max={3} step={0.05} />
        </div>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={resetDefaults} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Reset to defaults
          </Button>
          <Button onClick={() => setCurrentStep(5)}>
            Continue to Compliance →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SliderControl({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number;
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
