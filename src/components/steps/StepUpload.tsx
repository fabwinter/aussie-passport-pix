import { useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function StepUpload() {
  const { setOriginalImage, setOriginalFile, setCurrentStep } = usePhoto();
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Upload Your Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {preview && (
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
            <div className="flex justify-center">
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
