import { useEffect, useState, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

export default function StepBackgroundRemoval() {
  const { originalImage, bgRemovedImage, setBgRemovedImage, setCurrentStep } = usePhoto();
  const [loading, setLoading] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const removeBackground = useCallback(async () => {
    if (!originalImage) return;
    setLoading(true);
    try {
      // Load original image and draw with white background using canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = originalImage;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      
      // For demo: just set white background and draw image
      // In production, this would call remove.bg via edge function
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      setBgRemovedImage(dataUrl);
      toast.success("Background processed! Connect remove.bg API for full removal.");
    } catch {
      toast.error("Background removal failed. Please try again or upload a photo with a plain background.");
    } finally {
      setLoading(false);
    }
  }, [originalImage, setBgRemovedImage]);

  useEffect(() => {
    if (originalImage && !bgRemovedImage) {
      removeBackground();
    }
  }, [originalImage, bgRemovedImage, removeBackground]);

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
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Removing background…</p>
          </div>
        ) : originalImage && bgRemovedImage ? (
          <div className="space-y-4">
            <div
              ref={sliderRef}
              className="relative w-full max-w-md mx-auto aspect-[7/9] overflow-hidden rounded-lg border shadow-sm cursor-ew-resize select-none"
              onMouseDown={() => { dragging.current = true; }}
              onTouchStart={() => { dragging.current = true; }}
            >
              <img src={bgRemovedImage} alt="After" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                <img src={originalImage} alt="Before" className="w-full h-full object-cover" style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: "none" }} />
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
            <div className="flex justify-center">
              <Button onClick={() => setCurrentStep(3)}>
                Continue to Crop →
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Upload a photo first.</p>
        )}
      </CardContent>
    </Card>
  );
}
