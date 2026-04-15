import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const standards = [
  { label: "Photo size", value: "35mm × 45mm" },
  { label: "Background", value: "Plain white or light grey" },
  { label: "Head height", value: "32–36mm (70–80% of frame)" },
  { label: "Face", value: "Centred, neutral expression, mouth closed" },
  { label: "Eyes", value: "Open and clearly visible" },
  { label: "Glasses", value: "Not permitted" },
  { label: "Resolution", value: "Minimum 600 DPI for print" },
  { label: "Printed on", value: "10×15 cm (4×6 inch) photo paper" },
  { label: "Shadows", value: "No shadows on face or background" },
];

export default function StandardsSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Info className="w-4 h-4" />
          <span className="hidden sm:inline">AU Standards</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">📋 AU Passport Photo Standards</SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <ul className="space-y-3">
          {standards.map((s) => (
            <li key={s.label} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{s.label}</span>
              <span className="text-sm text-muted-foreground">{s.value}</span>
            </li>
          ))}
        </ul>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Standards sourced from the Australian Passport Office (passports.gov.au)
        </p>
      </SheetContent>
    </Sheet>
  );
}
