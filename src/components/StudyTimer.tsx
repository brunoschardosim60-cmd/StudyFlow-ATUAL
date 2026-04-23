import { useState, useCallback, useEffect, useRef } from "react";
import {
  Play, Pause, Square, RotateCcw, Timer, Clock,
  Minus, Plus, Coffee, Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlarmSettingsPanel,
  loadAlarmSettings,
  playAlarm,
  type AlarmSettings,
} from "@/components/AlarmSettingsPanel";

interface StudyTimerProps {
  running: boolean;
  formattedTime: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onOpenFocusMode?: () => void;
  activeTopicName?: string;
}

/**
 * Audio unlock helper: most browsers require a user gesture before
 * HTMLAudioElement.play() works. We play a silent buffer once on first
 * interaction so later programmatic plays (from setInterval) succeed.
 */
function useAudioUnlock() {
  const unlockedRef = useRef(false);
  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined" || unlockedRef.current) return;
    try {
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      );
      a.volume = 0;
      void a.play().then(() => { a.pause(); unlockedRef.current = true; }).catch(() => {});
    } catch {}
  }, []);
  return { ensureCtx };
}

async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

async function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "studyflow-pomodoro",
    requireInteraction: true,
    silent: false,
  };
  // Service Worker notifications are more reliable when the tab is in background or inside an iframe.
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, options); return; }
    }
  } catch {}
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      try {
        window.focus();
        if (window.parent && window.parent !== window) window.parent.focus();
        if (window.top && window.top !== window) window.top.focus();
      } catch {}
      n.close();
    };
  } catch {}
}

/**
 * While resting, mirror the countdown into the document title so users see
 * "🎯 Descanso 04:32 — StudyFlow" in their browser tab even on another page.
 */
function useTabTitle(active: boolean, prefix: string, seconds: number) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (!active) return;
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    document.title = `${prefix} ${mm}:${ss} — StudyFlow`;
    return () => { document.title = original; };
  }, [active, prefix, seconds]);
}

type PomPhase = "off" | "working" | "resting";

export function StudyTimer({
  running, formattedTime,
  onStart, onPause, onResume, onStop, onReset,
  onOpenFocusMode, activeTopicName,
}: StudyTimerProps) {
  const isInitial = formattedTime === "00:00:00";
  const { ensureCtx } = useAudioUnlock();
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(() => loadAlarmSettings());
  const alarmSettingsRef = useRef(alarmSettings);
  useEffect(() => { alarmSettingsRef.current = alarmSettings; }, [alarmSettings]);

  const playAlarmSound = useCallback((repeat = 3) => {
    playAlarm(alarmSettingsRef.current, repeat);
  }, []);

  const [pomOpen, setPomOpen] = useState(false);
  const [workMin, setWorkMin] = useState(25);
  const [restMin, setRestMin] = useState(5);
  const [phase, setPhase] = useState<PomPhase>("off");
  const [workRemaining, setWorkRemaining] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [cycles, setCycles] = useState(0);
  // Absolute deadline timestamps — immune to setInterval drift / background throttling.
  const deadlineRef = useRef<number>(0);

  // Reflect rest countdown in the browser tab title (visible from any other tab).
  useTabTitle(phase === "resting", "🎯 Descanso", restRemaining);


  // Refs to keep latest values inside the interval without restarting it.
  const phaseRef = useRef<PomPhase>("off");
  const workMinRef = useRef(workMin);
  const restMinRef = useRef(restMin);
  const onPauseRef = useRef(onPause);
  const onResumeRef = useRef(onResume);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { workMinRef.current = workMin; }, [workMin]);
  useEffect(() => { restMinRef.current = restMin; }, [restMin]);
  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);
  useEffect(() => { onResumeRef.current = onResume; }, [onResume]);

  // Single interval covering both phases, never restarted on cosmetic re-renders.
  useEffect(() => {
    if (phase === "off") return;

    const tick = () => {
      const remainingSec = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));

      if (phaseRef.current === "working") {
        setWorkRemaining(remainingSec);
        if (remainingSec <= 0) {
          playAlarmSound(5);
          notify("Pomodoro: hora de descansar 🎯", `Você completou ${workMinRef.current} min de foco.`);
          onPauseRef.current();
          phaseRef.current = "resting";
          deadlineRef.current = Date.now() + restMinRef.current * 60 * 1000;
          setPhase("resting");
          setRestRemaining(restMinRef.current * 60);
          setCycles((c) => c + 1);
        }
      } else if (phaseRef.current === "resting") {
        setRestRemaining(remainingSec);
        if (remainingSec <= 0) {
          playAlarmSound(3);
          notify("Pomodoro: de volta ao foco 🚀", `Pausa de ${restMinRef.current} min finalizada.`);
          onResumeRef.current();
          phaseRef.current = "working";
          deadlineRef.current = Date.now() + workMinRef.current * 60 * 1000;
          setPhase("working");
          setWorkRemaining(workMinRef.current * 60);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase, playAlarmSound]);

  const pomStart = async () => {
    // Critical: create AudioContext + ask notification permission INSIDE the user gesture.
    ensureCtx();
    void ensureNotificationPermission();

    // Subtract time already elapsed on the main stopwatch so the pomodoro
    // ends when total focus reaches workMin (2min done + 5min target = 3min remaining).
    const [hh, mm, ss] = formattedTime.split(":").map((n) => parseInt(n, 10) || 0);
    const elapsedSec = hh * 3600 + mm * 60 + ss;
    const remaining = Math.max(1, workMin * 60 - elapsedSec);

    setWorkRemaining(remaining);
    setRestRemaining(0);
    deadlineRef.current = Date.now() + remaining * 1000;
    phaseRef.current = "working";
    setPhase("working");
    if (!running && isInitial) onStart();
    else if (!running) onResume();
  };

  const pomStop = () => {
    phaseRef.current = "off";
    setPhase("off");
    setWorkRemaining(0);
    setRestRemaining(0);
  };

  const adjustTime = (type: "work" | "rest", delta: number) => {
    if (phase !== "off") return;
    if (type === "work") setWorkMin(Math.max(5, Math.min(120, workMin + delta)));
    else setRestMin(Math.max(1, Math.min(30, restMin + delta)));
  };

  const workProgress = phase === "working" ? 1 - workRemaining / (workMin * 60) : phase === "resting" ? 1 : 0;
  const restProgress = phase === "resting" ? 1 - restRemaining / (restMin * 60) : 0;

  const restFormatted = phase === "resting"
    ? `${String(Math.floor(restRemaining / 60)).padStart(2, "0")}:${String(restRemaining % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="glass-card rounded-xl p-4 space-y-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          <span className="text-sm font-heading font-semibold text-muted-foreground">Cronometro</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { ensureCtx(); setPomOpen((o) => !o); }}
            className={`rounded-lg p-2 transition-all ${pomOpen || phase !== "off" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            title="Pomodoro"
          >
            <Clock className="w-4 h-4" />
          </button>
          {onOpenFocusMode && !isInitial && (
            <button onClick={onOpenFocusMode} className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors" title="Modo foco">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center py-3">
        <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums tracking-wider">
          {formattedTime}
        </span>
        {activeTopicName && (
          <span className="text-xs text-muted-foreground mt-1 truncate max-w-full">Foco: {activeTopicName}</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-2 pb-1">
        {!running && isInitial && phase !== "resting" ? (
          <Button size="sm" onClick={() => { ensureCtx(); onStart(); }} className="gap-1.5 px-5">
            <Play className="w-3.5 h-3.5" /> Estudar
          </Button>
        ) : running ? (
          <Button size="sm" variant="outline" onClick={onPause} className="gap-1.5">
            <Pause className="w-3.5 h-3.5" /> Pausar
          </Button>
        ) : phase !== "resting" ? (
          <Button size="sm" onClick={() => { ensureCtx(); onResume(); }} className="gap-1.5">
            <Play className="w-3.5 h-3.5" /> Continuar
          </Button>
        ) : null}
        {!isInitial && (
          <>
            <Button size="icon" variant="outline" onClick={onReset} className="h-8 w-8">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="destructive" onClick={onStop} className="h-8 w-8">
              <Square className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Rest overlay banner */}
      {phase === "resting" && (
        <div className="mt-2 rounded-xl bg-accent/10 border border-accent/20 p-3 flex items-center gap-3 animate-in fade-in duration-300">
          <Coffee className="w-5 h-5 text-accent-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Hora do descanso!</p>
            <p className="text-xs text-muted-foreground">Voltando em {restFormatted}</p>
          </div>
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="2" />
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-primary" strokeWidth="2.5"
                strokeDasharray={`${restProgress * 94.25} 94.25`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s linear" }} />
            </svg>
          </div>
          <Button size="sm" variant="ghost" onClick={() => {
            onResume();
            phaseRef.current = "working";
            deadlineRef.current = Date.now() + workMin * 60 * 1000;
            setPhase("working");
            setWorkRemaining(workMin * 60);
            setRestRemaining(0);
          }} className="h-8 text-xs">
            Pular
          </Button>
        </div>
      )}

      {/* Pomodoro config panel */}
      {pomOpen && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-7 h-7">
                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="2" />
                  <circle cx="18" cy="18" r="15" fill="none" className="stroke-primary" strokeWidth="2.5"
                    strokeDasharray={`${workProgress * 94.25} 94.25`} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s linear" }} />
                </svg>
                <Clock className="w-3 h-3 absolute inset-0 m-auto text-primary" />
              </div>
              <span className="font-heading font-semibold text-sm">Pomodoro</span>
              {cycles > 0 && (
                <span className="text-xs text-muted-foreground">{cycles} ciclo{cycles !== 1 ? "s" : ""}</span>
              )}
            </div>
            {phase === "working" && running && (
              <span className="text-xs text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
                {Math.ceil(workRemaining / 60)} min restantes
              </span>
            )}
          </div>

          {phase === "off" && (
            <div className="flex gap-4 flex-wrap">
              <TimeAdjuster label="Foco" value={workMin} unit="min" onMinus={() => adjustTime("work", -5)} onPlus={() => adjustTime("work", 5)} />
              <TimeAdjuster label="Pausa" value={restMin} unit="min" onMinus={() => adjustTime("rest", -1)} onPlus={() => adjustTime("rest", 1)} />
            </div>
          )}

          <div className="flex items-center gap-1.5 justify-between">
            <AlarmSettingsPanel settings={alarmSettings} onChange={setAlarmSettings} />
            <div className="flex items-center gap-1.5">
              {phase === "off" ? (
                <Button size="sm" onClick={pomStart} className="gap-1.5 h-7 text-xs">
                  <Play className="w-3 h-3" /> Ativar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={pomStop} className="gap-1.5 h-7 text-xs">
                  <Square className="w-3 h-3" /> Desativar
                </Button>
              )}
              {onOpenFocusMode && phase !== "off" && (
                <Button size="sm" variant="ghost" onClick={onOpenFocusMode} className="h-7 text-xs" title="Modo foco">
                  <Maximize2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function TimeAdjuster({ label, value, unit, onMinus, onPlus }: {
  label: string; value: number; unit: string; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground min-w-[3rem]">{label}</span>
      <button onClick={onMinus} className="rounded-md border border-border p-0.5 hover:bg-muted transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <span className="font-mono text-sm font-medium w-6 text-center">{value}</span>
      <button onClick={onPlus} className="rounded-md border border-border p-0.5 hover:bg-muted transition-colors">
        <Plus className="w-3 h-3" />
      </button>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}
