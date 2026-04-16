import { useEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { Loader as Loader2, ArrowLeft, RotateCcw, SkipForward } from "lucide-react";
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
    setProgress("Loading AI model...");
    setEta(null);
    const t0 = Date.now();
    try {
      setProgress("Removing background...");
      const resultBlob = await removeBackground(originalImage, {
        progress: (key: string, current: number, total: number) => {
          const steps: Record<string, string> = {
            "compute:decode": "Decoding image...",
            "compute:inference": "Running AI model...",
            "compute:mask": "Applying mask...",
            "compute:encode": "Encoding result...",
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
      toast.error("Background removal failed. Please try again or skip if your photo already has a white background.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [originalImage, setBgRemovedImage]);

  useEffect(() => {
    if (originalImage && !bgRemovedImage) {
      removeBg();
    }
  }, [originalImage, bgRemovedImage, removeBg]);

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

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pos = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(2, Math.min(98, pos)));
  }, []);

  useEffect(() => {
    const handleUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [handlePointerMove]);

  if (!originalImage) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">Upload a photo first.</p>
        <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go to Upload
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-5 py-14 px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium">{progress || "Removing background..."}</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              This may take a few seconds on first run while the AI model loads.
            </p>
            {eta && (
              <p className="text-xs font-medium text-foreground">{eta}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={skipRemoval} className="gap-2 mt-1">
            <SkipForward className="w-3.5 h-3.5" /> Skip -- my background is already white
          </Button>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="rounded-lg bg-destructive/10 p-5 text-center space-y-3">
          <p className="font-medium text-sm text-destructive">Background removal failed</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
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
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Upload
          </Button>
        </div>
      </div>
    );
  }

  if (!bgRemovedImage) return null;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Background Removed</h2>
        <p className="text-xs text-muted-foreground">Drag the slider to compare before and after</p>
      </div>

      <div
        ref={sliderRef}
        className="relative w-full max-w-sm mx-auto aspect-[7/9] overflow-hidden rounded-xl border shadow-sm cursor-ew-resize select-none touch-none"
        onPointerDown={() => { dragging.current = true; }}
      >
        <img src={bgRemovedImage} alt="After" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img
            src={originalImage}
            alt="Before"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.3)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4.5 3L1.5 7L4.5 11" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 3L12.5 7L9.5 11" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">Before</span>
        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">After</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-2.5">
        <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          variant="outline"
          onClick={() => { setBgRemovedImage(null); removeBg(); }}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Redo
        </Button>
        <Button
          variant="outline"
          onClick={skipRemoval}
          className="gap-2"
        >
          <SkipForward className="w-4 h-4" /> Skip
        </Button>
        <Button onClick={() => setCurrentStep(3)} className="gap-1">
          Continue <span className="hidden sm:inline">to Crop</span> &rarr;
        </Button>
      </div>
    </div>
  );
}
