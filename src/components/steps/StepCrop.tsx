import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

const TARGET_W = 827;
const TARGET_H = 1063;
const ASPECT = 7 / 9;

function HeadOverlay({ width, height }: { width: number; height: number }) {
  if (!width || !height) return null;

  const faceHeightPct = 0.75;
  const faceTopPct = 0.06;
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
      <ellipse
        cx={faceCx}
        cy={faceCy}
        rx={faceW / 2}
        ry={faceH / 2}
        fill="none"
        stroke="rgba(59,130,246,0.6)"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />

      <line x1={width * 0.25} y1={crownY} x2={width * 0.75} y2={crownY}
        stroke="rgba(156,163,175,0.7)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.76} y={crownY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(156,163,175,0.8)">crown</text>

      <line x1={width * 0.15} y1={eyeY} x2={width * 0.85} y2={eyeY}
        stroke="rgba(59,130,246,0.6)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.86} y={eyeY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(59,130,246,0.7)">eyes</text>

      <line x1={width * 0.25} y1={chinY} x2={width * 0.75} y2={chinY}
        stroke="rgba(156,163,175,0.7)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={width * 0.76} y={chinY + 4} fontSize={Math.max(9, width * 0.03)} fill="rgba(156,163,175,0.8)">chin</text>

      <line x1={width * 0.08} y1={crownY} x2={width * 0.08} y2={chinY}
        stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
      <line x1={width * 0.06} y1={crownY} x2={width * 0.10} y2={crownY}
        stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
      <line x1={width * 0.06} y1={chinY} x2={width * 0.10} y2={chinY}
        stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
      <text
        x={width * 0.115}
        y={(crownY + chinY) / 2 + 4}
        fontSize={Math.max(8, width * 0.028)}
        fill="rgba(59,130,246,0.7)"
        transform={`rotate(-90, ${width * 0.115}, ${(crownY + chinY) / 2})`}
      >
        70-80%
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
  const [imgDims, setImgDims] = useState<{ width: number; height: number } | null>(null);
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

  useEffect(() => {
    if (!imgRef.current) return;
    const obs = new ResizeObserver(() => {
      if (imgRef.current) {
        setImgDims({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        });
      }
    });
    obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, []);

  const cropRect = completedCrop && imgDims ? {
    left: (completedCrop.x / 100) * imgDims.width,
    top: (completedCrop.y / 100) * imgDims.height,
    width: (completedCrop.width / 100) * imgDims.width,
    height: (completedCrop.height / 100) * imgDims.height,
  } : null;

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
      <div className="rounded-xl border bg-card shadow-sm p-8 text-center text-muted-foreground text-sm">
        Complete background removal first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Crop & Resize</h2>
        <p className="text-xs text-muted-foreground">
          Position the crop so the face fills 70-80% of the frame
        </p>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
        <p className="font-medium text-sm text-foreground">Head Positioning</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>Face height: 70-80% of frame</span>
          <span>Eyes: one-third from top</span>
          <span>Head centred left-to-right</span>
          <span>Full chin and crown visible</span>
        </div>
      </div>

      <div className="flex items-center justify-end">
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
          {showOverlay && cropRect && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: cropRect.left,
                top: cropRect.top,
                width: cropRect.width,
                height: cropRect.height,
              }}
            >
              <HeadOverlay width={cropRect.width} height={cropRect.height} />
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-center text-muted-foreground">
        Output: {TARGET_W} x {TARGET_H} px (35x45 mm at 600 DPI)
      </p>

      <div className="flex flex-col sm:flex-row justify-center gap-2.5">
        <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={applyCrop} className="gap-1">
          Apply Crop & Continue &rarr;
        </Button>
      </div>
    </div>
  );
}
