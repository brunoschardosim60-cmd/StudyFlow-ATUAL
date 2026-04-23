import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Upload, Play, Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ALARM_PRESETS, getAlarmDataUrl, type AlarmSoundId } from "@/lib/alarmSounds";

const STORAGE_KEY = "studyflow_alarm_settings";

export interface AlarmSettings {
  soundId: AlarmSoundId;
  volume: number;
  customDataUrl?: string;
  customName?: string;
}

const DEFAULT_SETTINGS: AlarmSettings = { soundId: "clock", volume: 0.8 };

export function loadAlarmSettings(): AlarmSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as AlarmSettings;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveAlarmSettings(s: AlarmSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function playAlarm(settings: AlarmSettings, repeat = 3): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  try {
    const src = settings.soundId === "custom" && settings.customDataUrl
      ? settings.customDataUrl
      : getAlarmDataUrl(settings.soundId, repeat);
    const a = new Audio(src);
    a.volume = Math.max(0, Math.min(1, settings.volume));
    void a.play().catch(() => {});
    return a;
  } catch { return null; }
}

interface Props {
  settings: AlarmSettings;
  onChange: (s: AlarmSettings) => void;
}

export function AlarmSettingsPanel({ settings, onChange }: Props) {
  const [local, setLocal] = useState(settings);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setLocal(settings); }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const update = (patch: Partial<AlarmSettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    saveAlarmSettings(next);
    onChange(next);
  };

  const preview = () => {
    previewRef.current?.pause();
    previewRef.current = playAlarm(local, 2);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("Arquivo muito grande. Use um áudio de até 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update({
        soundId: "custom",
        customDataUrl: reader.result as string,
        customName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const VolumeIcon = local.volume === 0 ? VolumeX : Volume2;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Volume do alarme"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <VolumeIcon className="w-3.5 h-3.5" />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-out flex items-center ${
          open ? "w-28 ml-1.5 opacity-100" : "w-0 ml-0 opacity-0"
        }`}
      >
        <Slider
          value={[local.volume * 100]}
          onValueChange={(v) => update({ volume: (v[0] ?? 0) / 100 })}
          min={0}
          max={100}
          step={5}
          className="flex-1"
        />
        <button
          onClick={() => setMoreOpen((o) => !o)}
          title="Mais opções"
          className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      </div>

      {open && moreOpen && (
        <div className="absolute z-50 bottom-full left-0 mb-1.5 w-52 rounded-lg border border-border/50 bg-popover shadow-md p-2.5 space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <select
            value={local.soundId}
            onChange={(e) => update({ soundId: e.target.value as AlarmSoundId })}
            className="w-full text-xs bg-transparent border border-border/50 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {ALARM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            {local.customDataUrl && (
              <option value="custom">{local.customName ?? "Personalizado"}</option>
            )}
          </select>
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={preview}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Play className="w-3 h-3" /> Testar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="w-3 h-3" /> Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>
      )}
    </div>
  );
}
