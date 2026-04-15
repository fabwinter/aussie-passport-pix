import { useEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, ArrowLeft, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { removeBackground } from "@imgly/background-removal";

// How long to wait before giving up (ms)
const REMOVAL_TIMEOUT_MS = 60_000;

// The library downloads its ONNX model at runtime. We point it at jsDelivr
// so the request isn't blocked by the default CDN.
const BG_REMOVAL_PUBLIC_PATH =
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/";

export default function StepBackgroundRemoval() {
  const { originalImage, bgRemovedImage, setBgRemovedImage, setCurrentStep } = usePhoto();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Incremented on every new run. Callbacks from stale runs are ignored.
  const runVersionRef = useRef(0);

  const removeBg = useCallback(async () => {
    if (!originalImage) return;

    const version = ++runVersionRef.current;

    setLoading(true);
    setHasError(false);
    setErrorMessage("");
    setProgress("Loading AI model…");

    // Race the actual work against a hard timeout so the spinner can never
    // spin forever.
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("timeout")),
        REMOVAL_TIMEOUT_MS,
      );
    });

    try {
      const res = await fetch(originalImage);
      const blob = await res.blob();

      if (version !== runVersionRef.current) return; // stale
      setProgress("Removing background…");

      const resultBlob = await Promise.race([
        removeBackground(blob, {
          publicPath: BG_REMOVAL_PUBLIC_PATH,
          progress: (key: string, current: number, total: number) => {
            if (version !== runVersionRef.current) return;
            if (key === "compute:inference") {
              const pct = total > 0 ? Math.round((current / total) * 100) : 0;
              setProgress(`Processing… ${pct}%`);
            } else if (key.startsWith("fetch:")) {
              const pct = total > 0 ? Math.round((current / total) * 100) : 0;
              setProgress(`Downloading AI model… ${pct}%`);
            } else if (key.toLowerCase().includes("onnx")) {
              setProgress("Initialising AI engine…");
            }
          },
        }),
        timeoutPromise,
      ]);

      clearTimeout(timeoutHandle!);
      if (version !== runVersionRef.current) return; // stale

      // Composite result onto a white background canvas
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

      if (version !== runVersionRef.current) return; // stale
      setBgRemovedImage(canvas.toDataURL("image/png"));
      toast.success("Background removed successfully!");
    } catch (err) {
      clearTimeout(timeoutHandle!);
      if (version !== runVersionRef.current) return; // stale

      const isTimeout = err instanceof Error && err.message === "timeout";
      const msg = isTimeout
        ? "Background removal timed out after 60 seconds."
        : "Background removal failed.";

      setHasError(true);
      setErrorMessage(msg);
      toast.error(msg + " Use Try Again or Skip if your background is already white.");
    } finally {
      if (version === runVersionRef.current) {
        setLoading(false);
        setProgress("");
      }
    }
  }, [originalImage, setBgRemovedImage]);

  // Auto-run once when arriving at this step with no result yet.
  // We use a ref guard so clicking "Remove Again" (which sets bgRemovedImage
  // to null) doesn't cause a double-call — the button calls removeBg()
  // directly, and the ref prevents the effect from also calling it.
  const autoRunDoneRef = useRef(false);
  useEffect(() => {
    if (originalImage && !bgRemovedImage && !autoRunDoneRef.current) {
      autoRunDoneRef.current = true;
      removeBg();
    }
  }, [originalImage, bgRemovedImage, removeBg]);

  // Skip background removal — places the original photo on a white canvas
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
      toast.success("Skipped background removal — make sure your background is already white.");
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
                Takes 10–30 s on first run while the AI model downloads. Times out after 60 s.
              </p>
            </div>
            {/* Escape hatch — visible immediately so users aren't stranded */}
            <Button
              size="sm"
              variant="ghost"
              onClick={skipRemoval}
              className="gap-2 text-muted-foreground mt-2"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip — my background is already white
            </Button>
          </div>
        ) : hasError ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-4 text-center space-y-3">
              <p className="font-medium">{errorMessage || "Background removal failed"}</p>
              <p className="text-xs opacity-80">
                This usually means the AI model could not be downloaded. Check your internet
                connection and try again, or use Skip if your photo already has a white background.
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
            {/* Before / After comparison slider */}
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
                onClick={() => {
                  // Reset state and trigger a fresh run via removeBg() directly.
                  // The autoRunDoneRef is intentionally NOT reset here — we call
                  // removeBg() directly so the effect guard doesn't double-fire.
                  setBgRemovedImage(null);
                  removeBg();
                }}
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
