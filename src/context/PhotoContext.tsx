import React, { createContext, useContext, useState, useCallback } from "react";

export interface ComplianceResults {
  whiteBackground: boolean;
  correctAspectRatio: boolean;
  sufficientResolution: boolean;
  colourPhoto: boolean;
}

interface PhotoContextType {
  currentStep: number;
  setCurrentStep: (s: number) => void;
  originalImage: string | null;
  setOriginalImage: (s: string | null) => void;
  originalFile: File | null;
  setOriginalFile: (f: File | null) => void;
  bgRemovedImage: string | null;
  setBgRemovedImage: (s: string | null) => void;
  croppedImage: string | null;
  setCroppedImage: (s: string | null) => void;
  enhancedImage: string | null;
  setEnhancedImage: (s: string | null) => void;
  printSheet: string | null;
  setPrintSheet: (s: string | null) => void;
  brightness: number;
  setBrightness: (n: number) => void;
  contrast: number;
  setContrast: (n: number) => void;
  sharpness: number;
  setSharpness: (n: number) => void;
  saturation: number;
  setSaturation: (n: number) => void;
  complianceResults: ComplianceResults;
  setComplianceResults: (r: ComplianceResults) => void;
  resetAll: () => void;
}

const defaultCompliance: ComplianceResults = {
  whiteBackground: false,
  correctAspectRatio: false,
  sufficientResolution: false,
  colourPhoto: false,
};

const PhotoContext = createContext<PhotoContextType | null>(null);

export function PhotoProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [bgRemovedImage, setBgRemovedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [printSheet, setPrintSheet] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(1.15);
  const [contrast, setContrast] = useState(1.10);
  const [sharpness, setSharpness] = useState(1.30);
  const [saturation, setSaturation] = useState(1.0);
  const [complianceResults, setComplianceResults] = useState<ComplianceResults>(defaultCompliance);

  const resetAll = useCallback(() => {
    setCurrentStep(1);
    setOriginalImage(null);
    setOriginalFile(null);
    setBgRemovedImage(null);
    setCroppedImage(null);
    setEnhancedImage(null);
    setPrintSheet(null);
    setBrightness(1.15);
    setContrast(1.10);
    setSharpness(1.30);
    setSaturation(1.0);
    setComplianceResults(defaultCompliance);
  }, []);

  return (
    <PhotoContext.Provider
      value={{
        currentStep, setCurrentStep,
        originalImage, setOriginalImage,
        originalFile, setOriginalFile,
        bgRemovedImage, setBgRemovedImage,
        croppedImage, setCroppedImage,
        enhancedImage, setEnhancedImage,
        printSheet, setPrintSheet,
        brightness, setBrightness,
        contrast, setContrast,
        sharpness, setSharpness,
        saturation, setSaturation,
        complianceResults, setComplianceResults,
        resetAll,
      }}
    >
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhoto() {
  const ctx = useContext(PhotoContext);
  if (!ctx) throw new Error("usePhoto must be used within PhotoProvider");
  return ctx;
}
