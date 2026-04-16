import { Check, Upload, Layers, Crop, Sun, ClipboardCheck, Printer } from "lucide-react";
import { usePhoto } from "@/context/PhotoContext";

const steps = [
  { label: "Upload", icon: Upload },
  { label: "Background", icon: Layers },
  { label: "Crop", icon: Crop },
  { label: "Enhance", icon: Sun },
  { label: "Check", icon: ClipboardCheck },
  { label: "Print", icon: Printer },
];

export default function StepProgress() {
  const { currentStep } = usePhoto();

  return (
    <nav className="w-full py-5 px-2" aria-label="Progress">
      <ol className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isActive = currentStep === stepNum;
          const Icon = step.icon;

          return (
            <li key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={`
                    w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    text-sm font-semibold transition-all duration-300
                    ${isComplete
                      ? "bg-success text-success-foreground shadow-sm"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-[3px] ring-primary/20 shadow-md"
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`
                    text-[11px] font-medium hidden sm:block transition-colors duration-300
                    ${isActive ? "text-primary" : isComplete ? "text-success" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
                {isActive && (
                  <span className="sm:hidden text-[10px] font-semibold text-primary absolute -bottom-4 whitespace-nowrap">
                    {step.label}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-1.5 sm:mx-2.5">
                  <div
                    className={`
                      h-[2px] rounded-full transition-all duration-500
                      ${isComplete ? "bg-success" : "bg-border"}
                    `}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
