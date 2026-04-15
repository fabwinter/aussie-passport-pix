import { useEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, ArrowLeft, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { removeBackground } from "@imgly/background-removal";

// ─── Canvas-based background removal ────────────────────────────────────────
// Pure browser implementation — no CDN, no model download, works offline.
// Ideal for passport photos which already have a plain-colour background.
// Algorithm: flood-fill from all four edges using colour distance tolerance.
function removeBackgroundCanvas(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      // Average background colour from the four 10×10 px corners
      const CS = 10;
      let rSum = 0, gSum = 0, bSum = 0, n = 0;
      for (const [ox, oy] of [[0, 0], [w - CS, 0], [0, h - CS], [w - CS, h - CS]] as [number, number][]) {
        for (let y = oy; y < Math.min(oy + CS, h); y++) {
          for (let x = ox; x < Math.min(ox + CS, w); x++) {
            const i = (y * w + x) * 4;
            rSum += d[i]; gSum += d[i + 1]; bSum += d[i + 2]; n++;
          }
        }
      }
      const bgR = rSum / n, bgG = gSum / n, bgB = bSum / n;

      // Colour distance threshold — increase for more aggressive removal
      const TOLERANCE = 40;
      const isBg = (i: number) => {
        const dr = d[i] - bgR, dg = d[i + 1] - bgG, db = d[i + 2] - bgB;
        return Math.sqrt(dr * dr + dg * dg + db * db) <= TOLERANCE;
      };

      // Flood-fill mask seeded from all four edges
      const mask = new Uint8Array(w * h);
      const stack: number[] = [];

      const push = (x: number, y: number) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (mask[idx] === 1) return;
        if (!isBg(idx * 4)) return;
        mask[idx] = 1;
        stack.push(idx);
      };

      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 1; y < h - 1; y++) { push(0, y); push(w - 1, y); }

      while (stack.length > 0) {
        const idx = stack.pop()!;
        const x = idx % w, y = (idx / w) | 0;
        push(x + 1, y); push(x - 1, y);
        push(x, y + 1); push(x, y - 1);
      }

      // Replace background pixels with white
      for (let i = 0; i < w * h; i++) {
        if (mask[i]) {
          const p = i * 4;
          d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; d[p + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Composite onto a fresh white canvas to guarantee a white background
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      const octx = out.getContext("2d")!;
      octx.fillStyle = "#FFFFFF";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(canvas, 0, 0);

      resolve(out.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function StepBackgroundRemoval() {
  const {
    originalImage, originalFile,
    bgRemovedImage, setBgRemovedImage,
    setCurrentStep,
  } = usePhoto();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [hasError, setHasError] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Incremented on every new run; lets us discard results from stale runs
  const runVersionRef = useRef(0);

  const removeBg = useCallback(async () => {
    if (!originalImage) return;
    const version = ++runVersionRef.current;

    setLoading(true);
    setHasError(false);
    setProgress("Loading AI model…");

    let usedFallback = false;
    let resultDataUrl: string | null = null;

    // ── Step 1: Try AI removal ──────────────────────────────────────────────
    // Pass originalFile (a File/Blob) directly to avoid unreliable fetch() on
    // blob: URLs in iOS Safari and other mobile browsers.
    try {
      const blob: Blob = originalFile ?? await (await fetch(originalImage)).blob();

      const aiPromise = removeBackground(blob, {
        // Let the library resolve its own publicPath so the version always
        // matches the bundled code — don't hardcode a CDN version string here.
        progress: (key: string, current: number, total: number) => {
          if (version !== runVersionRef.current) return;
          if (key === "compute:inference") {
            setProgress(`Processing… ${Math.round((current / total) * 100)}%`);
          } else if (key.startsWith("fetch:")) {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            setProgress(`Downloading AI model… ${pct}%`);
          } else if (key.toLowerCase().includes("onnx")) {
            setProgress("Initialising AI engine…");
          }
        },
      });

      // 20 s timeout — if the model CDN is unreachable, fall through quickly
      const resultBlob: Blob = await Promise.race([
        aiPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ai_timeout")), 20_000)
        ),
      ]);

      if (version !== runVersionRef.current) return;

      const img = new Image();
      const resultUrl = URL.createObjectURL(resultBlob);
      await new Promise<void>((res, rej) => {
        img.onload = () => res(); img.onerror = rej; img.src = resultUrl;
      });

      const cvs = document.createElement("canvas");
      cvs.width = img.width; cvs.height = img.height;
      const ctx = cvs.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(resultUrl);

      resultDataUrl = cvs.toDataURL("image/png");
    } catch {
      // AI failed / timed out — fall through to canvas removal
      usedFallback = true;
    }

    // ── Step 2: Canvas fallback ─────────────────────────────────────────────
    if (usedFallback) {
      if (version !== runVersionRef.current) return;
      setProgress("Removing background locally…");
      try {
        resultDataUrl = await removeBackgroundCanvas(originalImage);
      } catch {
        if (version !== runVersionRef.current) return;
        setHasError(true);
        setLoading(false);
        setProgress("");
        toast.error("Background removal failed. Use Skip or try a different photo.");
        return;
      }
    }

    if (version !== runVersionRef.current) return;
    setBgRemovedImage(resultDataUrl!);
    setLoading(false);
    setProgress("");
    toast.success(
      usedFallback
        ? "Background removed (local method)."
        : "Background removed with AI."
    );
  }, [originalImage, originalFile, setBgRemovedImage]);

  // Auto-run once on first arrival; ref-guard prevents double-call from
  // "Remove Again" (which calls removeBg() directly).
  const autoRunDoneRef = useRef(false);
  useEffect(() => {
    if (originalImage && !bgRemovedImage && !autoRunDoneRef.current) {
      autoRunDoneRef.current = true;
      removeBg();
    }
  }, [originalImage, bgRemovedImage, removeBg]);

  // Skip: cancel any in-progress run, place original on white, go to Crop
  const skipRemoval = useCallback(() => {
    if (!originalImage) return;
    // Increment version so any ongoing removeBg() discards its result
    runVersionRef.current++;
    setLoading(false);
    setProgress("");
    setHasError(false);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setBgRemovedImage(canvas.toDataURL("image/png"));
      setCurrentStep(3);
      toast.success("Skipped background removal — ensure your background is plain white.");
    };
    img.src = originalImage;
  }, [originalImage, setBgRemovedImage, setCurrentStep]);

  // Drag slider
  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setSliderPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", handleMouseMove, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", up);
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

        {loading && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{progress || "Removing background…"}</p>
              <p className="text-xs text-muted-foreground">
                Trying AI removal first — falls back to local method automatically
              </p>
            </div>
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
        )}

        {!loading && hasError && (
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-4 text-center space-y-3">
              <p className="font-medium">Background removal failed</p>
              <p className="text-xs opacity-80">
                Both AI and local methods failed. Try again with a well-lit photo, or
                use Skip if your background is already plain white.
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
        )}

        {!loading && !hasError && originalImage && bgRemovedImage && (
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
              <div className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg" style={{ left: `${sliderPos}%` }}>
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg">
                  ⟺
                </div>
              </div>
              <div className="absolute top-2 left-2 text-xs font-semibold bg-foreground/70 text-background px-2 py-0.5 rounded">Before</div>
              <div className="absolute top-2 right-2 text-xs font-semibold bg-foreground/70 text-background px-2 py-0.5 rounded">After</div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Drag the slider to compare. Continue if the result looks good.
            </p>

            <div className="flex justify-center gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                variant="outline"
                onClick={() => { setBgRemovedImage(null); removeBg(); }}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Remove Again
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Continue to Crop →
              </Button>
            </div>
          </div>
        )}

        {!loading && !hasError && !bgRemovedImage && (
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
