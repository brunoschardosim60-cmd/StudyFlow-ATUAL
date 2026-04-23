import { useState, useEffect } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface CustomColors {
  primary: string;
  secondary: string;
  accent: string;
}

const STORAGE_KEY = "studyflow.customColors";

const PRESETS: { name: string; colors: CustomColors }[] = [
  { name: "Padrão", colors: { primary: "#3366cc", secondary: "#2e9975", accent: "#e09020" } },
  { name: "Roxo", colors: { primary: "#7c3aed", secondary: "#06b6d4", accent: "#f43f5e" } },
  { name: "Verde", colors: { primary: "#059669", secondary: "#0284c7", accent: "#d97706" } },
  { name: "Rosa", colors: { primary: "#db2777", secondary: "#8b5cf6", accent: "#f59e0b" } },
  { name: "Oceano", colors: { primary: "#0891b2", secondary: "#10b981", accent: "#f97316" } },
];

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyCustomColors() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const colors: CustomColors = JSON.parse(stored);
    const root = document.documentElement;
    root.style.setProperty("--primary", hexToHSL(colors.primary));
    root.style.setProperty("--ring", hexToHSL(colors.primary));
    root.style.setProperty("--secondary", hexToHSL(colors.secondary));
    root.style.setProperty("--accent", hexToHSL(colors.accent));
  } catch { /* ignore */ }
}

export function CustomThemeDialog() {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<CustomColors>(PRESETS[0].colors);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setColors(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const apply = (c: CustomColors) => {
    setColors(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    applyCustomColors();
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setColors(PRESETS[0].colors);
    const root = document.documentElement;
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--accent");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Personalizar cores">
          <Palette className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Cores</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Presets */}
          <div className="space-y-2">
            <Label>Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => apply(p.colors)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors"
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.primary }} />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.secondary }} />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.accent }} />
                  <span className="ml-1">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom colors */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.primary}
                  onChange={(e) => apply({ ...colors, primary: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => apply({ ...colors, secondary: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.accent}
                  onChange={(e) => apply({ ...colors, accent: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Preview</p>
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded-md flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: colors.primary }}>Primária</div>
              <div className="h-8 flex-1 rounded-md flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: colors.secondary }}>Secundária</div>
              <div className="h-8 flex-1 rounded-md flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: colors.accent }}>Destaque</div>
            </div>
          </div>

          <Button variant="outline" onClick={reset} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> Restaurar Padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
