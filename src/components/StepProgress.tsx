import { Check } from "lucide-react";
import { usePhoto } from "@/context/PhotoContext";

const steps = [
  "Upload",
  "Background",
  "Crop",
  "Enhance",
  "Compliance",
  "Print",
];

export default function StepProgress() {
  const { currentStep } = usePhoto();

  return (
    <div className="w-full py-4 px-2">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isActive = currentStep === stepNum;

          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isComplete
                      ? "bg-success text-success-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive ? "text-primary" : isComplete ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    isComplete ? "bg-success" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
