import { useEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader as Loader2, Layers, ArrowLeft, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { removeBackground } from "@imgly/background-removal";

export default function StepBackgroundRemoval() {
  const { originalImage, bgRemovedImage, setBgRemovedImage, setCurrentStep } = usePhoto();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [eta, setEta] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const removeBg = useCallback(async () => {
    if (!originalImage) return;
    setLoading(true);
    setHasError(false);
    setProgress("Loading AI model…");
    setEta(null);
    const t0 = Date.now();
    try {
      setProgress("Removing background…");
      const resultBlob = await removeBackground(originalImage, {
        progress: (key: string, current: number, total: number) => {
          const steps: Record<string, string> = {
            "compute:decode": "Decoding image…",
            "compute:inference": "Running AI model…",
            "compute:mask": "Applying mask…",
            "compute:encode": "Encoding result…",
          };
          if (steps[key]) {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            setProgress(`${steps[key]} ${pct > 0 && pct < 100 ? `${pct}%` : ""}`.trim());
          }
          if (key === "fetch:ort-wasm-simd-threaded.jsep") {
            const elapsed = (Date.now() - t0) / 1000;
            if (total > 0 && current > 0 && elapsed > 0.5) {
              const rate = current / elapsed;
              const remaining = (total - current) / Math.max(rate, 1);
              if (remaining > 2) setEta(`${Math.round(remaining)}s remaining`);
              else setEta(null);
            }
          }
        },
      });

      const img = new Image();
      const resultUrl = URL.createObjectURL(resultBlob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = resultUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(resultUrl);

      setBgRemovedImage(canvas.toDataURL("image/png"));
      toast.success("Background removed successfully!");
    } catch {
      setHasError(true);
      toast.error("Background removal failed. Please try again or use Skip if your photo already has a white background.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [originalImage, setBgRemovedImage]);

  // Auto-run on first arrival
  useEffect(() => {
    if (originalImage && !bgRemovedImage) {
      removeBg();
    }
  }, [originalImage, bgRemovedImage, removeBg]);

  // Skip background removal — treats original image as-is on white canvas
  const skipRemoval = useCallback(() => {
    if (!originalImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setBgRemovedImage(canvas.toDataURL("image/png"));
      toast.success("Skipped background removal. Make sure your background is already white.");
    };
    img.src = originalImage;
  }, [originalImage, setBgRemovedImage]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  }, []);

  useEffect(() => {
    const handleUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [handleMouseMove]);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Background Removal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{progress || "Removing background…"}</p>
              <p className="text-xs text-muted-foreground">
                This may take a few seconds on first run while the AI model loads.
                {eta && <span className="block mt-1 font-medium text-foreground">{eta}</span>}
              </p>
            </div>
          </div>
        ) : hasError ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-4 text-center space-y-3">
              <p className="font-medium">Background removal failed</p>
              <p className="text-xs opacity-80">
                This can happen with large images or slow connections. Try again, or skip if your photo already has a plain white background.
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Button size="sm" onClick={removeBg} className="gap-2">
                  <RotateCcw className="w-3.5 h-3.5" /> Try Again
                </Button>
                <Button size="sm" variant="outline" onClick={skipRemoval} className="gap-2">
                  <SkipForward className="w-3.5 h-3.5" /> Skip (white bg)
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Upload
              </Button>
            </div>
          </div>
        ) : originalImage && bgRemovedImage ? (
          <div className="space-y-4">
            {/* Before / After slider */}
            <div
              ref={sliderRef}
              className="relative w-full max-w-md mx-auto aspect-[7/9] overflow-hidden rounded-lg border shadow-sm cursor-ew-resize select-none"
              onMouseDown={() => { dragging.current = true; }}
              onTouchStart={() => { dragging.current = true; }}
            >
              <img src={bgRemovedImage} alt="After" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                <img
                  src={originalImage}
                  alt="Before"
                  className="w-full h-full object-cover"
                  style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: "none" }}
                />
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg">
                  ⟺
                </div>
              </div>
              <div className="absolute top-2 left-2 text-xs font-semibold bg-foreground/70 text-background px-2 py-0.5 rounded">Before</div>
              <div className="absolute top-2 right-2 text-xs font-semibold bg-foreground/70 text-background px-2 py-0.5 rounded">After</div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Drag the slider to compare. If the result looks good, continue.
            </p>

            <div className="flex justify-center gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                variant="outline"
                onClick={() => { setBgRemovedImage(null); removeBg(); }}
                className="gap-2"
                title="Re-run background removal on the same photo"
              >
                <RotateCcw className="w-4 h-4" /> Remove Again
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Continue to Crop →
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Upload a photo first.</p>
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Go to Upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
