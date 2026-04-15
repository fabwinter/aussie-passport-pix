import { useEffect, useRef, useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sun, RotateCcw, ArrowLeft } from "lucide-react";

export default function StepEnhance() {
  const {
    croppedImage, setEnhancedImage,
    brightness, setBrightness,
    contrast, setContrast,
    sharpness, setSharpness,
    setCurrentStep,
  } = usePhoto();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image once
  useEffect(() => {
    if (!croppedImage) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = croppedImage;
  }, [croppedImage]);

  // Apply enhancements in real-time whenever sliders change
  const applyEnhancements = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;

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
  }, [brightness, contrast, sharpness, imageLoaded]);

  useEffect(() => {
    if (imageLoaded) applyEnhancements();
  }, [applyEnhancements, imageLoaded]);

  const saveAndContinue = useCallback(() => {
    if (!canvasRef.current) return;
    setEnhancedImage(canvasRef.current.toDataURL("image/jpeg", 0.95));
    setCurrentStep(5);
  }, [setEnhancedImage, setCurrentStep]);

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
