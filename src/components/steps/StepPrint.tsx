import { useEffect, useRef, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, RotateCcw, ArrowLeft } from "lucide-react";

const SHEET_W = 1181;
const SHEET_H = 1772;
const PHOTO_W = 827;
const PHOTO_H = 1063;

export default function StepPrint() {
  const { enhancedImage, printSheet, setPrintSheet, resetAll, setCurrentStep } = usePhoto();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generatePrintSheet = useCallback(() => {
    if (!enhancedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SHEET_W;
      canvas.height = SHEET_H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, SHEET_W, SHEET_H);

      const scaledW = (SHEET_W - 60) / 2;
      const scaledH = scaledW * (PHOTO_H / PHOTO_W);
      const gapX = (SHEET_W - scaledW * 2) / 3;
      const gapY = (SHEET_H - scaledH * 2 - 40) / 3;

      const positions = [
        [gapX, gapY],
        [gapX * 2 + scaledW, gapY],
        [gapX, gapY * 2 + scaledH],
        [gapX * 2 + scaledW, gapY * 2 + scaledH],
      ];

      positions.forEach(([x, y]) => {
        ctx.drawImage(img, x, y, scaledW, scaledH);
        ctx.strokeStyle = "#E0E0E0";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, scaledW, scaledH);
      });

      ctx.fillStyle = "#999999";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Australian Passport Photo | 35×45mm | Print at 10×15cm (4×6 inch)", SHEET_W / 2, SHEET_H - 15);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      setPrintSheet(dataUrl);

      if (canvasRef.current) {
        const vc = canvasRef.current;
        vc.width = SHEET_W;
        vc.height = SHEET_H;
        vc.getContext("2d")!.drawImage(canvas, 0, 0);
      }
    };
    img.src = enhancedImage;
  }, [enhancedImage, setPrintSheet]);

  useEffect(() => { generatePrintSheet(); }, [generatePrintSheet]);

  const downloadFile = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  if (!enhancedImage) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Complete enhancement first.</CardContent></Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary" />
          Printable 10×15 cm Template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <canvas ref={canvasRef} className="max-w-full max-h-80 rounded-lg border shadow-sm" />
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button onClick={() => enhancedImage && downloadFile(enhancedImage, "passport-photo-600dpi.jpg")} className="gap-2">
            <Download className="w-4 h-4" /> Download Single Photo (600 DPI)
          </Button>
          <Button onClick={() => printSheet && downloadFile(printSheet, "passport-print-10x15cm.jpg")} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Download Print Template (10×15 cm)
          </Button>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(5)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button variant="ghost" onClick={resetAll} className="gap-2 text-muted-foreground">
            <RotateCcw className="w-4 h-4" /> Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
