import { useEffect, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ClipboardCheck } from "lucide-react";

const manualChecks = [
  "Ensure eyes are open and clearly visible",
  "Ensure neutral expression, mouth closed",
  "Ensure no glasses, hat, or head covering",
  "Ensure no shadows on face or background",
];

export default function StepCompliance() {
  const { enhancedImage, complianceResults, setComplianceResults, setCurrentStep } = usePhoto();

  const runAutoChecks = useCallback(() => {
    if (!enhancedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // Check white background - sample corners
      const corners = [
        ctx.getImageData(0, 0, 10, 10),
        ctx.getImageData(img.width - 10, 0, 10, 10),
        ctx.getImageData(0, img.height - 10, 10, 10),
        ctx.getImageData(img.width - 10, img.height - 10, 10, 10),
      ];
      const whiteBackground = corners.every((corner) => {
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < corner.data.length; i += 4) {
          r += corner.data[i]; g += corner.data[i + 1]; b += corner.data[i + 2]; count++;
        }
        return r / count > 220 && g / count > 220 && b / count > 220;
      });

      // Check aspect ratio (7:9 = 0.778)
      const ratio = img.width / img.height;
      const correctAspectRatio = Math.abs(ratio - 7 / 9) < 0.02;

      // Check resolution (827x1063 at 600 DPI)
      const sufficientResolution = img.width >= 827 && img.height >= 1063;

      // Check colour (not grayscale)
      const sample = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 50, 50);
      let colorVariance = 0;
      for (let i = 0; i < sample.data.length; i += 4) {
        const diff = Math.abs(sample.data[i] - sample.data[i + 1]) + Math.abs(sample.data[i + 1] - sample.data[i + 2]);
        colorVariance += diff;
      }
      const colourPhoto = colorVariance / (sample.data.length / 4) > 5;

      setComplianceResults({ whiteBackground, correctAspectRatio, sufficientResolution, colourPhoto });
    };
    img.src = enhancedImage;
  }, [enhancedImage, setComplianceResults]);

  useEffect(() => {
    runAutoChecks();
  }, [runAutoChecks]);

  const autoChecks = [
    { label: "White background detected", pass: complianceResults.whiteBackground },
    { label: "Correct aspect ratio 35×45mm", pass: complianceResults.correctAspectRatio },
    { label: "Sufficient resolution ≥ 600 DPI", pass: complianceResults.sufficientResolution },
    { label: "Colour photo", pass: complianceResults.colourPhoto },
  ];

  const allAutoPass = autoChecks.every((c) => c.pass);

  if (!enhancedImage) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Complete enhancement first.</CardContent></Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Compliance Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
          allAutoPass ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        }`}>
          {allAutoPass ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {allAutoPass ? "Ready to print ✅" : "Issues found ⚠️"}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Auto Checks</p>
          {autoChecks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.pass ? (
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              )}
              <span>{c.label}</span>
              <Badge variant={c.pass ? "default" : "destructive"} className={`ml-auto text-xs ${c.pass ? "bg-success text-success-foreground" : ""}`}>
                {c.pass ? "Pass" : "Fail"}
              </Badge>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manual Checks</p>
          {manualChecks.map((label) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <span>{label}</span>
              <Badge variant="outline" className="ml-auto text-xs">Review</Badge>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button onClick={() => setCurrentStep(6)}>
            Continue to Print Template →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
