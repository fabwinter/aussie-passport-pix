import { useEffect, useRef, useCallback, useState } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { Download, Printer, RotateCcw, ArrowLeft, ChevronDown, ChevronUp, CircleCheck as CheckCircle } from "lucide-react";

const SHEET_W = 1181;
const SHEET_H = 1772;
const PHOTO_W = 827;
const PHOTO_H = 1063;

const LAB_INSTRUCTIONS = [
  { text: 'Print on 10x15 cm (4x6 inch) photo paper at 100% scale -- disable "fit to page"' },
  { text: "At a photo lab: upload the file and specify 10x15 cm, standard glossy finish, no borders" },
  { text: "Use the dashed cut guides to separate the four passport photos after printing" },
  { text: "Each finished photo will be exactly 35x45 mm when cut along the guides" },
  { text: "Glossy or matte finish both accepted -- standard 200-300 gsm photo paper recommended" },
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

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, SHEET_W, SHEET_H);

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
        ctx.drawImage(img, x, y, scaledW, scaledH);
        ctx.save();
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = "#BBBBBB";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, scaledW, scaledH);
        ctx.restore();
      });

      ctx.fillStyle = "#888888";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Australian Passport Photo -- 35x45 mm -- Print at 10x15 cm (4x6 inch) -- Cut along guides",
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
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 3000);
    }, 600);
  }, [printSheet]);

  if (!enhancedImage) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-8 text-center text-muted-foreground text-sm">
        Complete enhancement first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Your Photos Are Ready</h2>
        <p className="text-xs text-muted-foreground">
          Four 35x45 mm photos on a 10x15 cm sheet with cut guides
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 flex justify-center p-4">
          <canvas ref={canvasRef} className="max-w-full max-h-72 rounded-lg shadow-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Button onClick={handlePrint} className="gap-2 h-11">
          <Printer className="w-4 h-4" /> Print Now
        </Button>
        <Button
          variant="outline"
          onClick={() => printSheet && downloadFile(printSheet, "passport-print-10x15cm.jpg")}
          className="gap-2 h-11"
        >
          <Download className="w-4 h-4" /> Print Template
        </Button>
        <Button
          variant="outline"
          onClick={() => enhancedImage && downloadFile(enhancedImage, "passport-photo-35x45mm.jpg")}
          className="gap-2 h-11"
        >
          <Download className="w-4 h-4" /> Single Photo
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowInstructions((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg border px-4 py-2.5"
      >
        <span>How to print these photos</span>
        {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showInstructions && (
        <ol className="space-y-2 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-4 py-3.5 list-decimal list-inside">
          {LAB_INSTRUCTIONS.map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ol>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-2.5 pt-1">
        <Button variant="outline" onClick={() => setCurrentStep(5)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button variant="ghost" onClick={resetAll} className="gap-2 text-muted-foreground">
          <RotateCcw className="w-4 h-4" /> Start Over
        </Button>
      </div>
    </div>
  );
}
