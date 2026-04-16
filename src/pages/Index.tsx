import { useEffect, useRef } from "react";
import { PhotoProvider, usePhoto } from "@/context/PhotoContext";
import StepProgress from "@/components/StepProgress";
import StandardsSidebar from "@/components/StandardsSidebar";
import StepUpload from "@/components/steps/StepUpload";
import StepBackgroundRemoval from "@/components/steps/StepBackgroundRemoval";
import StepCrop from "@/components/steps/StepCrop";
import StepEnhance from "@/components/steps/StepEnhance";
import StepCompliance from "@/components/steps/StepCompliance";
import StepPrint from "@/components/steps/StepPrint";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";

const stepMap: Record<number, () => JSX.Element> = {
  1: StepUpload,
  2: StepBackgroundRemoval,
  3: StepCrop,
  4: StepEnhance,
  5: StepCompliance,
  6: StepPrint,
};

function AppContent() {
  const { currentStep, setCurrentStep } = usePhoto();
  const StepComponent = stepMap[currentStep];
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = currentStep;
    if (currentStep > prev) {
      window.history.pushState({ step: currentStep }, "");
    }
  }, [currentStep]);

  useEffect(() => {
    const onPopState = () => {
      const target = currentStep > 1 ? currentStep - 1 : 1;
      setCurrentStep(target);
      window.history.pushState({ step: target }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setCurrentStep, currentStep]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg leading-none">🇦🇺</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight tracking-tight">
                Aussie Passport Photo
              </h1>
              <p className="text-[11px] text-muted-foreground leading-none hidden sm:block">
                Free, private, browser-based
              </p>
            </div>
          </div>
          <StandardsSidebar />
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6">
        <StepProgress />
      </div>

      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 pb-16 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t bg-card/60 py-5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-success flex-shrink-0" />
            <span>Photos processed locally in your browser -- never uploaded to any server</span>
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>
          <span className="text-xs text-muted-foreground/60">
            Not affiliated with the Australian Government
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function Index() {
  return (
    <PhotoProvider>
      <AppContent />
    </PhotoProvider>
  );
}
