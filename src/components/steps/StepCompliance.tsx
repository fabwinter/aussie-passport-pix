import { useEffect, useCallback } from "react";
import { usePhoto } from "@/context/PhotoContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, ArrowLeft, Info, Bot, Loader as Loader2 } from "lucide-react";

const manualChecks = [
  {
    label: "Eyes open, clearly visible and looking directly at camera",
    tip: "Eyes should be clearly visible -- no squinting or looking away",
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
    label: "Head straight and facing directly forward -- not tilted or turned",
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

      const patchSize = 20;
      const corners = [
        ctx.getImageData(2, 2, patchSize, patchSize),
        ctx.getImageData(img.width - patchSize - 2, 2, patchSize, patchSize),
        ctx.getImageData(2, img.height - patchSize - 2, patchSize, patchSize),
        ctx.getImageData(img.width - patchSize - 2, img.height - patchSize - 2, patchSize, patchSize),
      ];

      const whiteBackground = corners.every((corner) => {
        let lightCount = 0;
        const totalCount = corner.data.length / 4;
        for (let i = 0; i < corner.data.length; i += 4) {
          const r = corner.data[i];
          const g = corner.data[i + 1];
          const b = corner.data[i + 2];
          if (r > 200 && g > 200 && b > 200) lightCount++;
        }
        return lightCount / Math.max(totalCount, 1) > 0.70;
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
    setAiCheck({ status: "running", reasons: [], checks: [] });
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpbmVwYXpqZHhjdnB3a3htcm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzExODcsImV4cCI6MjA5MTg0NzE4N30.GZj4EsZV2bWxKx3mKmTf1iMZTzSUE5BW7oFMDeT-abE";
      const aiCheckUrl = import.meta.env.VITE_AI_CHECK_URL
        || import.meta.env.VITE_SUPABASE_URL && `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/passport-ai-check`
        || "https://linepazjdxcvpwkxmrna.supabase.co/functions/v1/passport-ai-check";

      // Resize image to max 800px wide before sending to avoid edge function memory limits
      const resizedImage = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          const scale = img.width > MAX ? MAX / img.width : 1;
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        };
        img.onerror = reject;
        img.src = enhancedImage;
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(aiCheckUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "Apikey": anonKey,
        },
        body: JSON.stringify({ image: resizedImage, country: "AU" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.error) {
        setAiCheck({ status: "error", reasons: [data.details ?? data.error], checks: [] });
        return;
      }
      setAiCheck({
        status: data.pass ? "pass" : "fail",
        reasons: (data.checks ?? []).filter((c: { pass: boolean }) => !c.pass).map((c: { detail: string }) => c.detail),
        checks: data.checks ?? [],
      });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setAiCheck({
        status: "error",
        reasons: [isTimeout ? "Request timed out. Please try again." : "Could not contact AI checker. Try again later."],
        checks: [],
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
      label: "White or light grey background",
      detail: "Corner patches must be 75%+ light pixels",
      pass: complianceResults.whiteBackground,
      fix: "Re-run background removal or adjust lighting.",
      fixStep: 2,
      fixLabel: "Background",
    },
    {
      label: "Correct aspect ratio (35x45 mm / 7:9)",
      detail: "Width-to-height ratio within 2% of 7:9",
      pass: complianceResults.correctAspectRatio,
      fix: "Re-crop the photo to restore the correct ratio.",
      fixStep: 3,
      fixLabel: "Crop",
    },
    {
      label: "Sufficient resolution (600 DPI)",
      detail: "Minimum 827 x 1063 px",
      pass: complianceResults.sufficientResolution,
      fix: "Upload a higher-resolution source photo.",
      fixStep: 1,
      fixLabel: "Upload",
    },
    {
      label: "Colour photo",
      detail: "RGB colour variance detected",
      pass: complianceResults.colourPhoto,
      fix: "Ensure source photo is in colour.",
      fixStep: 4,
      fixLabel: "Enhance",
    },
  ];

  const allAutoPass = autoChecks.every((c) => c.pass);

  if (!enhancedImage) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-8 text-center text-muted-foreground text-sm">
        Complete enhancement first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Compliance Checklist</h2>
        <p className="text-xs text-muted-foreground">Verifying your photo meets Australian passport standards</p>
      </div>

      <div className="flex gap-4 items-start">
        <img
          src={enhancedImage}
          alt="Final photo"
          className="w-20 rounded-lg border shadow-sm flex-shrink-0 object-contain"
        />
        <div className={`flex-1 rounded-lg p-3 text-sm font-medium flex items-center gap-2.5 ${
          allAutoPass ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        }`}>
          {allAutoPass
            ? <><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> All automated checks passed</>
            : <><AlertTriangle className="w-5 h-5 flex-shrink-0" /> Some checks need attention</>
          }
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Automated Checks
        </p>
        <div className="rounded-xl border divide-y overflow-hidden">
          {autoChecks.map((c) => (
            <div key={c.label} className="px-3.5 py-2.5 space-y-1.5 bg-card">
              <div className="flex items-center gap-2 text-sm">
                {c.pass
                  ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                }
                <span className="flex-1 font-medium">{c.label}</span>
                <Badge
                  variant={c.pass ? "default" : "destructive"}
                  className={`text-[10px] px-1.5 ${c.pass ? "bg-success text-success-foreground" : ""}`}
                >
                  {c.pass ? "Pass" : "Fail"}
                </Badge>
              </div>
              {!c.pass && (
                <div className="pl-6 flex items-center gap-2">
                  <p className="text-xs text-muted-foreground flex-1">
                    <span className="text-destructive font-medium">Fix: </span>{c.fix}
                  </p>
                  {c.fixStep && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-6 px-2 flex-shrink-0"
                      onClick={() => setCurrentStep(c.fixStep!)}
                    >
                      Go to {c.fixLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          AI Analysis
        </p>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={aiCheck.status === "running"}
              className="gap-2"
              onClick={runAiCheck}
            >
              {aiCheck.status === "running"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Bot className="w-4 h-4" />
              }
              {aiCheck.status === "running"
                ? "Analysing..."
                : aiCheck.status !== "idle"
                  ? "Re-run AI Check"
                  : "Run AI Passport Check"
              }
            </Button>
            {aiCheck.status === "pass" && (
              <span className="text-xs text-success font-medium">All checks passed</span>
            )}
            {aiCheck.status === "fail" && (
              <span className="text-xs text-warning font-medium">Some checks failed -- review below</span>
            )}
            {aiCheck.status === "error" && (
              <span className="text-xs text-destructive font-medium">
                {aiCheck.reasons[0] ?? "AI check unavailable."}
              </span>
            )}
          </div>

          {aiCheck.status === "idle" && (
            <p className="text-xs text-muted-foreground">
              Run a pixel analysis against Australian passport photo requirements including aspect ratio, resolution, background, lighting, colour, and head position.
            </p>
          )}

          {(aiCheck.status === "pass" || aiCheck.status === "fail") && aiCheck.checks.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Full Report</p>
              <div className="rounded-lg border divide-y overflow-hidden">
                {aiCheck.checks.map((c) => (
                  <div key={c.label} className="px-3 py-2 space-y-1 bg-card">
                    <div className="flex items-center gap-2 text-sm">
                      {c.pass
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                      }
                      <span className="flex-1 font-medium text-[13px]">{c.label}</span>
                      <Badge
                        variant={c.pass ? "default" : "outline"}
                        className={`text-[10px] px-1.5 ${
                          c.pass ? "bg-success text-success-foreground" : "border-warning text-warning"
                        }`}
                      >
                        {c.pass ? "Pass" : "Fail"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{c.detail}</p>
                    {c.fix && (
                      <p className="text-xs pl-6">
                        <span className="font-medium text-warning">Fix: </span>
                        <span className="text-muted-foreground">{c.fix}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Manual Review
        </p>
        <div className="rounded-xl border divide-y overflow-hidden">
          {manualChecks.map((c) => (
            <div key={c.label} className="px-3.5 py-2.5 space-y-1 bg-card">
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                <span className="flex-1">{c.label}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">Review</Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-6">{c.tip}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row justify-center gap-2.5">
        <Button variant="outline" onClick={() => setCurrentStep(4)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={() => setCurrentStep(6)} className="gap-1">
          Continue <span className="hidden sm:inline">to Print</span> &rarr;
        </Button>
      </div>
    </div>
  );
}
