import { useEffect, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, ClipboardCheck, ArrowLeft, Info, Bot } from "lucide-react";

const manualChecks = [
  {
    label: "Eyes open, clearly visible and looking directly at camera",
    tip: "Eyes should be clearly visible — no squinting or looking away",
  },
  {
    label: "Neutral expression with mouth closed",
    tip: "No smiling, frowning or raised eyebrows",
  },
  {
    label: "No glasses (not permitted for Australian passports since 2012)",
    tip: "Prescription glasses must be removed",
  },
  {
    label: "No hat or head covering (except for religious/medical reasons)",
    tip: "Hair accessories that don't obscure the face are acceptable",
  },
  {
    label: "Head straight and facing directly forward — not tilted or turned",
    tip: "Shoulders should be level and face centred in frame",
  },
  {
    label: "No shadows on face or background",
    tip: "Use even, diffuse lighting from the front",
  },
  {
    label: "Photo taken within the last 6 months (12 months for under 18)",
    tip: "The photo must be a current likeness",
  },
];

export default function StepCompliance() {
  const { enhancedImage, complianceResults, setComplianceResults, aiCheck, setAiCheck, setCurrentStep } = usePhoto();

  const runAutoChecks = useCallback(() => {
    if (!enhancedImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const margin = Math.round(img.width * 0.04);
      const patchSize = 15;
      const corners = [
        ctx.getImageData(margin, margin, patchSize, patchSize),
        ctx.getImageData(img.width - margin - patchSize, margin, patchSize, patchSize),
        ctx.getImageData(margin, img.height - margin - patchSize, patchSize, patchSize),
        ctx.getImageData(img.width - margin - patchSize, img.height - margin - patchSize, patchSize, patchSize),
      ];

      const whiteBackground = corners.every((corner) => {
        let brightCount = 0;
        const totalCount = corner.data.length / 4;
        for (let i = 0; i < corner.data.length; i += 4) {
          const r = corner.data[i];
          const g = corner.data[i + 1];
          const b = corner.data[i + 2];
          if (r > 210 && g > 210 && b > 210) brightCount++;
        }
        return brightCount / Math.max(totalCount, 1) > 0.9;
      });

      const ratio = img.width / img.height;
      const correctAspectRatio = Math.abs(ratio - 7 / 9) < 0.02;

      const sufficientResolution = img.width >= 827 && img.height >= 1063;

      const sample = ctx.getImageData(
        Math.floor(img.width / 4),
        Math.floor(img.height / 4),
        Math.floor(img.width / 2),
        Math.floor(img.height / 2),
      );
      let colorVariance = 0;
      for (let i = 0; i < sample.data.length; i += 4) {
        colorVariance +=
          Math.abs(sample.data[i] - sample.data[i + 1]) +
          Math.abs(sample.data[i + 1] - sample.data[i + 2]);
      }
      const colourPhoto = colorVariance / (sample.data.length / 4) > 5;

      setComplianceResults({ whiteBackground, correctAspectRatio, sufficientResolution, colourPhoto });
    };
    img.src = enhancedImage;
  }, [enhancedImage, setComplianceResults]);

  useEffect(() => { runAutoChecks(); }, [runAutoChecks]);

  const runAiCheck = useCallback(async () => {
    if (!enhancedImage || aiCheck.status === "running") return;
    setAiCheck({ status: "running", reasons: [] });
    try {
      const aiCheckUrl = import.meta.env.VITE_AI_CHECK_URL;
      if (!aiCheckUrl) {
        setAiCheck({ status: "error", reasons: ["AI checker endpoint not configured (VITE_AI_CHECK_URL)."] });
        return;
      }
      const res = await fetch(aiCheckUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: enhancedImage, country: "AU" }),
      });
      const data = await res.json();
      setAiCheck({
        status: data.pass ? "pass" : "fail",
        reasons: data.reasons ?? [],
      });
    } catch {
      setAiCheck({
        status: "error",
        reasons: ["Could not contact AI checker. Try again later."],
      });
    }
  }, [enhancedImage, aiCheck.status, setAiCheck]);

  const autoChecks: {
    label: string;
    detail: string;
    pass: boolean;
    fix: string;
    fixStep?: number;
    fixLabel?: string;
  }[] = [
    {
      label: "White background",
      detail: "Corner patches must be ≥90% bright pixels (>210/255)",
      pass: complianceResults.whiteBackground,
      fix: "Re-run background removal or adjust lighting in the Enhance step.",
      fixStep: 2,
      fixLabel: "Go to Background Removal",
    },
    {
      label: "Correct aspect ratio (35×45 mm / 7:9)",
      detail: "Width-to-height ratio must be within ±2% of 7∶9",
      pass: complianceResults.correctAspectRatio,
      fix: "Re-crop the photo to restore the correct 7:9 ratio.",
      fixStep: 3,
      fixLabel: "Go to Crop & Resize",
    },
    {
      label: "Sufficient resolution (≥ 600 DPI)",
      detail: "Minimum 827 × 1063 px for 35×45 mm at 600 DPI",
      pass: complianceResults.sufficientResolution,
      fix: "Upload a higher-resolution source photo (at least 800 × 1000 px).",
      fixStep: 1,
      fixLabel: "Go to Upload",
    },
    {
      label: "Colour photo",
      detail: "RGB colour variance detected in face region",
      pass: complianceResults.colourPhoto,
      fix: "Ensure your source photo is in colour — check the Saturation slider in the Enhance step.",
      fixStep: 4,
      fixLabel: "Go to Enhance",
    },
  ];

  const allAutoPass = autoChecks.every((c) => c.pass);

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
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Compliance Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-4 items-start">
          <img
            src={enhancedImage}
            alt="Final photo being checked"
            className="w-20 rounded border shadow-sm flex-shrink-0 object-contain"
          />
          <div className={`flex-1 rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
            allAutoPass ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}>
            {allAutoPass
              ? <><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> All automated checks passed — ready to print</>
              : <><AlertTriangle className="w-5 h-5 flex-shrink-0" /> One or more automated checks failed — see details below</>
            }
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Automated Checks (applied to final adjusted photo)
          </p>
          {autoChecks.map((c) => (
            <div key={c.label} className="rounded-lg border px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {c.pass
                  ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                }
                <span className="flex-1 font-medium">{c.label}</span>
                <Badge
                  variant={c.pass ? "default" : "destructive"}
                  className={`ml-auto text-xs ${c.pass ? "bg-success text-success-foreground" : ""}`}
                >
                  {c.pass ? "Pass" : "Fail"}
                </Badge>
              </div>
              {!c.pass && (
                <div className="pl-6 flex items-start gap-2">
                  <p className="text-xs text-muted-foreground flex-1">
                    <span className="font-medium text-destructive">Fix: </span>{c.fix}
                  </p>
                  {c.fixStep && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 flex-shrink-0 whitespace-nowrap"
                      onClick={() => setCurrentStep(c.fixStep!)}
                    >
                      {c.fixLabel ?? "Go Fix"} →
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Optional AI Check (Australian standards)
          </p>
          <div className="rounded-lg border px-3 py-3 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={aiCheck.status === "running" || !enhancedImage}
                className="gap-2"
                onClick={runAiCheck}
              >
                <Bot className="w-4 h-4" />
                {aiCheck.status === "running" ? "Checking…" : "Run AI Passport Check"}
              </Button>
              {aiCheck.status === "pass" && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Likely to pass Australian passport photo standards.
                </span>
              )}
              {aiCheck.status === "fail" && (
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Potential issues detected — see notes below.
                </span>
              )}
              {aiCheck.status === "error" && (
                <span className="text-xs text-destructive font-medium">
                  {aiCheck.reasons[0] ?? "AI check unavailable."}
                </span>
              )}
            </div>
            {aiCheck.status === "idle" && (
              <p className="text-xs text-muted-foreground">
                Optional: run an AI check against Australian passport photo requirements. Requires VITE_AI_CHECK_URL to be configured.
              </p>
            )}
            {aiCheck.reasons.length > 0 && aiCheck.status !== "error" && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {aiCheck.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Manual Checks — please review your photo carefully
          </p>
          {manualChecks.map((c) => (
            <div key={c.label} className="rounded-lg border px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="flex-1">{c.label}</span>
                <Badge variant="outline" className="ml-auto text-xs">Review</Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-6">{c.tip}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setCurrentStep(4)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Enhancement
          </Button>
          <Button onClick={() => setCurrentStep(6)}>
            Continue to Print Template →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
