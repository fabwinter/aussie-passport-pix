import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon } from "lucide-react";

const TARGET_W = 827;
const TARGET_H = 1063;
const ASPECT = 7 / 9;

export default function StepCrop() {
  const { bgRemovedImage, setCroppedImage, setCurrentStep } = usePhoto();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, ASPECT, w, h),
      w,
      h
    );
    setCrop(c);
    setCompletedCrop(c);
  }, []);

  const applyCrop = useCallback(() => {
    if (!imgRef.current || !completedCrop) return;
    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d")!;

    const scaleX = image.naturalWidth / 100;
    const scaleY = image.naturalHeight / 100;

    const sx = (completedCrop.x ?? 0) * scaleX;
    const sy = (completedCrop.y ?? 0) * scaleY;
    const sw = (completedCrop.width ?? 0) * scaleX;
    const sh = (completedCrop.height ?? 0) * scaleY;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);

    setCroppedImage(canvas.toDataURL("image/jpeg", 0.95));
    setCurrentStep(4);
  }, [completedCrop, setCroppedImage, setCurrentStep]);

  if (!bgRemovedImage) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Complete background removal first.</CardContent></Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CropIcon className="w-5 h-5 text-primary" />
          Crop & Resize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adjust the crop area to frame your face. Output: {TARGET_W}×{TARGET_H}px (35×45mm at 600 DPI)
        </p>
        <div className="flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, pc) => setCrop(pc)}
            onComplete={(_, pc) => setCompletedCrop(pc)}
            aspect={ASPECT}
            className="max-h-96"
          >
            <img
              ref={imgRef}
              src={bgRemovedImage}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-h-96"
            />
          </ReactCrop>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Target: {TARGET_W} × {TARGET_H} pixels (7:9 aspect ratio)
        </p>
        <div className="flex justify-center">
          <Button onClick={applyCrop}>Apply Crop & Continue →</Button>
        </div>
      </CardContent>
    </Card>
  );
}
