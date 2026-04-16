import { useCallback, useState, useRef, useEffect } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { assessSuitability } from "@/lib/suitability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Camera, X, Circle, ChevronDown, ChevronUp, SwitchCamera } from "lucide-react";
import { toast } from "sonner";

const PHOTO_TIPS = [
  { icon: "🔆", text: "Even, shadow-free lighting from the front" },
  { icon: "📷", text: "Face directly forward, looking straight at the camera" },
  { icon: "⚪", text: "Plain background — the app will remove it automatically" },
  { icon: "😐", text: "Neutral expression, mouth closed" },
  { icon: "🚫", text: "No glasses, hats, or headwear (religious exceptions apply)" },
  { icon: "📅", text: "Taken within the last 6 months (12 months for under 18)" },
  { icon: "📐", text: "High resolution — at least 800 × 1000 px recommended" },
];

export default function StepUpload() {
  const { setOriginalImage, setOriginalFile, setCurrentStep, suitability, setSuitability } = usePhoto();
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const runSuitabilityCheck = useCallback(async (dataUrl: string) => {
    setSuitability(null);
    const result = await assessSuitability(dataUrl);
    setSuitability(result);
    if (!result.ok) {
      toast.warning("This photo may have issues — see notes below.");
    }
  }, [setSuitability]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const nativeTypes = ["image/jpeg", "image/png", "image/webp"];

    if (nativeTypes.includes(file.type)) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setOriginalImage(url);
      setOriginalFile(file);
      setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) + " KB" });
      runSuitabilityCheck(url);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          toast.error("Could not convert this image. Please save as JPG or PNG first.");
          return;
        }
        const ext = file.type.split("/")[1]?.toUpperCase() ?? "IMAGE";
        const convertedUrl = URL.createObjectURL(blob);
        const convertedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        setPreview(convertedUrl);
        setOriginalImage(convertedUrl);
        setOriginalFile(convertedFile);
        setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) + " KB" });
        toast.success(`${ext} converted to JPEG automatically.`);
        runSuitabilityCheck(convertedUrl);
      }, "image/jpeg", 0.95);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const isHeic = ["image/heic", "image/heif"].includes(file.type);
      toast.error(
        isHeic
          ? "HEIC not supported in this browser. On iPhone: open in Photos → Share → Save to Files as JPEG, then upload."
          : "Could not read this image. Please try JPG or PNG format."
      );
    };
    img.src = objectUrl;
  }, [setOriginalImage, setOriginalFile, runSuitabilityCheck]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (mode: "environment" | "user" = "environment") => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser. Please upload a file instead.");
      return;
    }
    // Stop existing stream before starting new one
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied or unavailable. Please upload a photo instead.");
      toast.error("Camera access denied.");
    }
  }, []);

  const switchCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    startCamera(next);
  }, [facingMode, startCamera]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      processFile(file);
      stopCamera();
    }, "image/jpeg", 0.95);
  }, [processFile, stopCamera]);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Upload Your Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cameraActive ? (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-2 border-white/70"
                  style={{
                    width: "42%",
                    paddingBottom: "56%",
                    borderRadius: "50% 50% 46% 46% / 40% 40% 60% 60%",
                    position: "absolute",
                    top: "8%",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={switchCamera}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                title="Switch camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                <span className={`text-xs px-2 py-1 rounded font-medium ${facingMode === "environment" ? "bg-emerald-600/80 text-white" : "bg-amber-600/80 text-white"}`}>
                  {facingMode === "environment" ? "Rear camera (recommended)" : "Front camera — not recommended for passports"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Centre your face inside the oval. Look straight ahead with a neutral expression.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={stopCamera} className="flex-1 gap-2">
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button onClick={capturePhoto} className="flex-1 gap-2">
                <Circle className="w-4 h-4 fill-current" /> Capture Photo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag & drop your photo here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP or HEIC</p>
              <input
                id="file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-muted-foreground/20" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-muted-foreground/20" />
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={() => startCamera("environment")}>
              <Camera className="w-4 h-4" />
              Take Photo with Camera
            </Button>

            {cameraError && (
              <p className="text-xs text-destructive text-center">{cameraError}</p>
            )}

            <button
              type="button"
              onClick={() => setShowTips((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg border px-3 py-2"
            >
              <span>Tips for the best passport photo</span>
              {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showTips && (
              <ul className="space-y-1.5 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-3">
                {PHOTO_TIPS.map((t) => (
                  <li key={t.text} className="flex gap-2">
                    <span className="flex-shrink-0">{t.icon}</span>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {preview && !cameraActive && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <img
                src={preview}
                alt="Uploaded preview"
                className="max-h-64 rounded-lg border shadow-sm object-contain"
              />
            </div>
            {fileInfo && (
              <p className="text-sm text-muted-foreground text-center">
                {fileInfo.name} · {fileInfo.size}
              </p>
            )}

            {suitability && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  suitability.ok
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700"
                    : "border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
                }`}
              >
                <p className={`font-medium text-sm ${suitability.ok ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}`}>
                  {suitability.ok ? "Photo looks broadly suitable" : "Potential issues detected"}
                </p>
                {!suitability.ok && (
                  <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                    {suitability.reasons.map((r) => (
                      <li key={r} className="text-xs text-amber-700 dark:text-amber-400">{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => { setPreview(null); setFileInfo(null); setSuitability(null); }}
              >
                Choose Different Photo
              </Button>
              <Button onClick={() => setCurrentStep(2)}>
                Continue to Background Removal →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
