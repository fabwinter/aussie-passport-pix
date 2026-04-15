import { useCallback, useState, useRef, useEffect } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, Camera, X, Circle } from "lucide-react";
import { toast } from "sonner";

export default function StepUpload() {
  const { setOriginalImage, setOriginalFile, setCurrentStep } = usePhoto();
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const processFile = useCallback((file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Please upload a JPG or PNG file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setOriginalImage(url);
    setOriginalFile(file);
    setFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
    });
  }, [setOriginalImage, setOriginalFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser. Please upload a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied or unavailable. Please upload a photo instead.");
      toast.error("Camera access denied.");
    }
  }, []);

  // Attach stream to video element once camera is active
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Cleanup stream on unmount
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
              {/* Oval face-position guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-2 border-white/70 opacity-80"
                  style={{
                    width: "42%",
                    paddingBottom: "56%",
                    borderRadius: "50% 50% 46% 46% / 40% 40% 60% 60%",
                    position: "absolute",
                    top: "8%",
                  }}
                />
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
              <p className="text-xs text-muted-foreground">JPG or PNG only</p>
              <input
                id="file-input"
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-muted-foreground/20" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-muted-foreground/20" />
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={startCamera}>
              <Camera className="w-4 h-4" />
              Take Photo with Camera
            </Button>

            {cameraError && (
              <p className="text-xs text-destructive text-center">{cameraError}</p>
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
                {fileInfo.name} • {fileInfo.size}
              </p>
            )}
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setFileInfo(null);
                }}
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
