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

function AppContent() {
  const { currentStep } = usePhoto();

  const stepComponents: Record<number, React.ReactNode> = {
    1: <StepUpload />,
    2: <StepBackgroundRemoval />,
    3: <StepCrop />,
    4: <StepEnhance />,
    5: <StepCompliance />,
    6: <StepPrint />,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🇦🇺</span>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Aussie Passport Photo
            </h1>
          </div>
          <StandardsSidebar />
        </div>
      </header>

      {/* Step Progress */}
      <div className="container max-w-4xl mx-auto px-4">
        <StepProgress />
      </div>

      {/* Step Content */}
      <main className="container max-w-2xl mx-auto px-4 pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {stepComponents[currentStep]}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-4">
        <div className="container max-w-4xl mx-auto px-4">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Your photos are processed locally in your browser and are never stored on our servers.
          </p>
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
