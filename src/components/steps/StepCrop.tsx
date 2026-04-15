import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon, ArrowLeft } from "lucide-react";

const TARGET_W = 827;
const TARGET_H = 1063;
const ASPECT = 7 / 9;

// SVG diagram showing AU passport face-position requirements
function FaceGuide() {
  return (
    <svg viewBox="0 0 56 72" width={56} height={72} className="flex-shrink-0 rounded border bg-white">
      {/* Photo border */}
      <rect x="0.5" y="0.5" width="55" height="71" fill="white" stroke="#D1D5DB" strokeWidth="1" />
      {/* Top-of-head guideline */}
      <line x1="2" y1="8" x2="54" y2="8" stroke="#9CA3AF" strokeWidth="0.7" strokeDasharray="2,2" />
      {/* Eye guideline — ~31% from top in a 7:9 frame */}
      <line x1="2" y1="26" x2="54" y2="26" stroke="#3B82F6" strokeWidth="0.8" strokeDasharray="2,2" />
      <text x="53" y="25" textAnchor="end" fontSize="4" fill="#3B82F6">eyes</text>
      {/* Chin guideline */}
      <line x1="2" y1="58" x2="54" y2="58" stroke="#9CA3AF" strokeWidth="0.7" strokeDasharray="2,2" />
      {/* Face oval — face fills ~70-80% of 72px height = 50-57px */}
      <ellipse cx="28" cy="33" rx="14" ry="25" fill="#F3F4F6" stroke="#6B7280" strokeWidth="1.2" strokeDasharray="3,2" />
      {/* Shoulders hint */}
      <path d="M 10 68 Q 14 60 28 58 Q 42 60 46 68" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.8" />
    </svg>
  );
}

export default function StepCrop() {
  const { bgRemovedImage, setCroppedImage, setCurrentStep } = usePhoto();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, ASPECT, w, h),
      w, h
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Complete background removal first.
        </CardContent>
      </Card>
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
        {/* Face positioning guide */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-start gap-3">
          <FaceGuide />
          <div className="text-xs text-muted-foreground space-y-1.5 flex-1">
            <p className="font-semibold text-foreground">Head Positioning Guide</p>
            <p>• Face height should be <strong>70–80%</strong> of the photo</p>
            <p>• Eyes roughly <strong>one-third from the top</strong> of the frame</p>
            <p>• Head centred left-to-right</p>
            <p>• Include the full top of the head and chin</p>
            <p className="text-primary/80">Drag the crop handles to adjust the framing.</p>
          </div>
        </div>

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
          Output: {TARGET_W} × {TARGET_H} px (35×45 mm at 600 DPI)
        </p>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button onClick={applyCrop}>Apply Crop & Continue →</Button>
        </div>
      </CardContent>
    </Card>
  );
}
