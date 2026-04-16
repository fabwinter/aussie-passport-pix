import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { Loader as Loader2, ArrowLeft, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { removeBackground } from "@imgly/background-removal";

export default function StepBackgroundRemoval() {
  const { originalImage, bgRemovedImage, setBgRemovedImage, setCurrentStep } = usePhoto();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const removeBg = useCallback(async () => {
    if (!originalImage) return;
    setLoading(true);
    setHasError(false);
    setProgress("Loading AI model...");
    setProgressPct(5);
    try {
      const resultBlob = await removeBackground(originalImage, {
        model: "small",
        progress: (key: string, current: number, total: number) => {
          if (key.startsWith("fetch:")) {
            const pct = total > 0 ? Math.round((current / total) * 40) : 0;
            setProgressPct(5 + pct);
            setProgress("Downloading AI model...");
          } else if (key === "compute:inference") {
            setProgress("Analysing image...");
            setProgressPct(55);
          } else if (key === "compute:mask") {
            setProgress("Creating mask...");
            setProgressPct(75);
          } else if (key === "compute:encode") {
            setProgress("Finalising...");
            setProgressPct(90);
          }
        },
      });

      setProgress("Applying white background...");
      setProgressPct(95);

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

      // Force any semi-transparent or near-white pixels to pure white
      // This eliminates grey/colour fringing at hair edges caused by alpha blending
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a < 255) {
          // Semi-transparent pixel: blend remaining transparency with white
          const blend = a / 255;
          d[i]     = Math.round(d[i]     * blend + 255 * (1 - blend));
          d[i + 1] = Math.round(d[i + 1] * blend + 255 * (1 - blend));
          d[i + 2] = Math.round(d[i + 2] * blend + 255 * (1 - blend));
          d[i + 3] = 255;
        }
        // Snap near-white pixels (background fringe) to pure white
        if (d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 230) {
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      setBgRemovedImage(canvas.toDataURL("image/png"));
      setProgressPct(100);
      toast.success("Background removed successfully!");
    } catch {
      setHasError(true);
      toast.error("Background removal failed. Please try again or skip.");
    } finally {
      setLoading(false);
      setProgress("");
      setProgressPct(0);
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

  useLayoutEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

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
          <div className="text-center space-y-3 w-full max-w-xs">
            <p className="text-sm font-medium">{progress || "Removing background..."}</p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              First run downloads the AI model (~20 MB). Subsequent runs are faster.
            </p>
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
        className="relative w-full max-w-sm mx-auto aspect-[7/9] overflow-hidden rounded-xl border shadow-sm cursor-ew-resize select-none touch-none bg-[#eee]"
        onPointerDown={() => { dragging.current = true; }}
      >
        {/* After image -- full width underneath */}
        <img
          src={bgRemovedImage}
          alt="After"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Before overlay -- clip div controls reveal width; inner image is full container size */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={originalImage}
            alt="Before"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: containerWidth > 0 ? `${containerWidth}px` : "100vw",
              height: "100%",
              objectFit: "cover",
              objectPosition: "left center",
            }}
          />
        </div>

        {/* Divider */}
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4.5 3L1.5 7L4.5 11" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 3L12.5 7L9.5 11" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full pointer-events-none">Before</span>
        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full pointer-events-none">After</span>
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
