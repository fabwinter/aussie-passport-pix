import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon, ArrowLeft, Eye, EyeOff } from "lucide-react";

const TARGET_W = 827;
const TARGET_H = 1063;
const ASPECT = 7 / 9;

function HeadOverlay({ width, height }: { width: number; height: number }) {
  if (!width || !height) return null;

  // Australian passport: face height 70–80% of photo height
  // Eyes at ~31% from top of photo
  // Head centred horizontally
  const faceHeightPct = 0.75;
  const faceTopPct = 0.06;   // small gap at top for hair
  const faceBottomPct = faceTopPct + faceHeightPct;

  const faceTop = height * faceTopPct;
  const faceBottom = height * faceBottomPct;
  const faceH = faceBottom - faceTop;
  const faceW = faceH * 0.68;
  const faceCx = width / 2;
  const faceCy = faceTop + faceH / 2;

  const eyeY = height * 0.31;
  const chinY = height * (faceTopPct + faceHeightPct * 0.96);
  const crownY = height * faceTopPct;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Face oval guide */}
      <ellipse
        cx={faceCx}
        cy={faceCy}
        rx={faceW / 2}
        ry={faceH / 2}
        fill="none"
        stroke="rgba(59,130,246,0.7)"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />

      {/* Crown line */}
      <line x1={width * 0.25} y1={crownY} x2={width * 0.75} y2={crownY}
        stroke="rgba(156,163,175,0.8)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.76} y={crownY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(156,163,175,0.9)">crown</text>

      {/* Eye line */}
      <line x1={width * 0.15} y1={eyeY} x2={width * 0.85} y2={eyeY}
        stroke="rgba(59,130,246,0.7)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.86} y={eyeY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(59,130,246,0.8)">eyes</text>

      {/* Chin line */}
      <line x1={width * 0.25} y1={chinY} x2={width * 0.75} y2={chinY}
        stroke="rgba(156,163,175,0.8)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.76} y={chinY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(156,163,175,0.9)">chin</text>

      {/* Face height bracket on left */}
      <line x1={width * 0.08} y1={crownY} x2={width * 0.08} y2={chinY}
        stroke="rgba(59,130,246,0.5)" strokeWidth="1" />
      <line x1={width * 0.06} y1={crownY} x2={width * 0.10} y2={crownY}
        stroke="rgba(59,130,246,0.5)" strokeWidth="1" />
      <line x1={width * 0.06} y1={chinY} x2={width * 0.10} y2={chinY}
        stroke="rgba(59,130,246,0.5)" strokeWidth="1" />
      <text
        x={width * 0.115}
        y={(crownY + chinY) / 2 + 4}
        fontSize={Math.max(8, width * 0.028)}
        fill="rgba(59,130,246,0.8)"
        transform={`rotate(-90, ${width * 0.115}, ${(crownY + chinY) / 2})`}
      >
        70–80%
      </text>
    </svg>
  );
}

export default function StepCrop() {
  const { bgRemovedImage, setCroppedImage, setCurrentStep } = usePhoto();
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [overlayDims, setOverlayDims] = useState<{ width: number; height: number } | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, ASPECT, w, h),
      w, h
    );
    setCrop(c);
    setCompletedCrop(c);
  }, []);

  // Track rendered image dimensions for overlay sizing
  useEffect(() => {
    if (!imgRef.current) return;
    const obs = new ResizeObserver(() => {
      if (imgRef.current) {
        setOverlayDims({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        });
      }
    });
    obs.observe(imgRef.current);
    return () => obs.disconnect();
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
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm">Head Positioning Requirements</p>
          <p>• Face height must be <strong>70–80%</strong> of the photo (crown to chin)</p>
          <p>• Eyes roughly <strong>one-third from the top</strong> of the frame</p>
          <p>• Head centred left-to-right with a small gap above the crown</p>
          <p>• Full chin and top of head must be visible</p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Adjust the crop handles to frame the head correctly.</p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setShowOverlay((v) => !v)}
          >
            {showOverlay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showOverlay ? "Hide guide" : "Show guide"}
          </Button>
        </div>

        <div className="flex justify-center" ref={containerRef}>
          <div className="relative inline-block">
            <ReactCrop
              crop={crop}
              onChange={(_, pc) => setCrop(pc)}
              onComplete={(_, pc) => setCompletedCrop(pc)}
              aspect={ASPECT}
              className="max-h-[420px]"
            >
              <img
                ref={imgRef}
                src={bgRemovedImage}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-h-[420px] block"
              />
            </ReactCrop>
            {showOverlay && overlayDims && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ width: overlayDims.width, height: overlayDims.height }}
              >
                <HeadOverlay width={overlayDims.width} height={overlayDims.height} />
              </div>
            )}
          </div>
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
