import { useEffect, useRef, useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, RotateCcw, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

const SHEET_W = 1181; // 10 cm at 300 DPI
const SHEET_H = 1772; // 15 cm at 300 DPI
const PHOTO_W = 827;
const PHOTO_H = 1063;

const LAB_INSTRUCTIONS = [
  { icon: "🖨️", text: 'Print on 10×15 cm (4×6 inch) photo paper at 100% scale — disable "fit to page" or "scale to fit"' },
  { icon: "🏪", text: "At a photo lab: upload the file and specify 10×15 cm, standard glossy finish, no borders" },
  { icon: "✂️", text: "Use the dashed cut guides to separate the four passport photos after printing" },
  { icon: "📏", text: "Each finished photo will be exactly 35×45 mm when cut along the guides" },
  { icon: "💡", text: "Glossy or matte finish both accepted — standard 200–300 gsm photo paper recommended" },
];

export default function StepPrint() {
  const { enhancedImage, printSheet, setPrintSheet, resetAll, setCurrentStep } = usePhoto();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const generatePrintSheet = useCallback(() => {
    if (!enhancedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SHEET_W;
      canvas.height = SHEET_H;
      const ctx = canvas.getContext("2d")!;

      // White sheet background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, SHEET_W, SHEET_H);

      // Photo dimensions scaled to fit 2×2 on the sheet with equal margins
      const scaledW = Math.floor((SHEET_W - 60) / 2);
      const scaledH = Math.floor(scaledW * (PHOTO_H / PHOTO_W));
      const gapX = Math.floor((SHEET_W - scaledW * 2) / 3);
      const gapY = Math.floor((SHEET_H - scaledH * 2 - 50) / 3);

      const positions: [number, number][] = [
        [gapX, gapY],
        [gapX * 2 + scaledW, gapY],
        [gapX, gapY * 2 + scaledH],
        [gapX * 2 + scaledW, gapY * 2 + scaledH],
      ];

      positions.forEach(([x, y]) => {
        // Draw photo
        ctx.drawImage(img, x, y, scaledW, scaledH);

        // Dashed cut guides
        ctx.save();
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = "#BBBBBB";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, scaledW, scaledH);
        ctx.restore();
      });

      // Sheet label
      ctx.fillStyle = "#888888";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Australian Passport Photo · 35×45 mm · Print at 10×15 cm (4×6 inch) · Cut along guides",
        SHEET_W / 2,
        SHEET_H - 18
      );

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

  // Opens an invisible iframe and triggers the browser print dialog
  const handlePrint = useCallback(() => {
    if (!printSheet) return;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-200%;left:-200%;width:1px;height:1px;opacity:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: white; }
        img { display: block; width: 100%; height: auto; }
        @media print { @page { size: 10cm 15cm; margin: 0; } }
      </style>
    </head><body><img src="${printSheet}" /></body></html>`);
    doc.close();
    // Small delay to ensure image data is ready in the iframe
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 3000);
    }, 600);
  }, [printSheet]);

  if (!enhancedImage) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Complete enhancement first.
        </CardContent>
      </Card>
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
        {/* Print sheet preview */}
        <div className="flex justify-center">
          <canvas ref={canvasRef} className="max-w-full max-h-80 rounded-lg border shadow-sm" />
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Four 35×45 mm photos with dashed cut guides — ready for printing on 10×15 cm paper
        </p>

        {/* Primary actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print Now
          </Button>
          <Button
            variant="outline"
            onClick={() => printSheet && downloadFile(printSheet, "passport-print-10x15cm.jpg")}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Download Print Template
          </Button>
          <Button
            variant="outline"
            onClick={() => enhancedImage && downloadFile(enhancedImage, "passport-photo-35x45mm-600dpi.jpg")}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Download Single Photo
          </Button>
        </div>

        {/* Collapsible print instructions */}
        <button
          type="button"
          onClick={() => setShowInstructions((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg border px-3 py-2"
        >
          <span>How to print these photos</span>
          {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showInstructions && (
          <ul className="space-y-2 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-3">
            {LAB_INSTRUCTIONS.map((item) => (
              <li key={item.text} className="flex gap-2">
                <span className="flex-shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Nav */}
        <div className="flex justify-center gap-3 pt-1">
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
