import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudySession, Subject } from "@/lib/studyData";
import { loadJsonStorage } from "@/lib/storage";

interface UseStudyTimerParams {
  onSessionEnd: (session: StudySession) => void;
  activeTopicId?: string | null;
  activeSubject?: Subject | null;
}

const TIMER_STORAGE_KEY = "studyflow.timer.v1";

export function useStudyTimer({
  onSessionEnd,
  activeTopicId,
  activeSubject,
}: UseStudyTimerParams) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);

  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const persistTimerState = useCallback((nextRunning: boolean, nextElapsed: number) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({ running: nextRunning, elapsed: nextElapsed, savedAt: Date.now() }),
      );
    } catch {}
  }, []);

  // Restore timer state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = loadJsonStorage<{ running: boolean; elapsed: number; savedAt: number }>(TIMER_STORAGE_KEY);
      if (saved) {
        if (saved.running) {
          const recovered = saved.elapsed + Math.max(0, Date.now() - saved.savedAt);
          setElapsed(recovered);
          setRunning(true);
        } else {
          setElapsed(saved.elapsed || 0);
        }
      }
    } catch {}

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  // Tick interval
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    startRef.current = Date.now() - elapsed;
    intervalRef.current = window.setInterval(() => {
      setElapsed(Date.now() - (startRef.current ?? Date.now()));
    }, 1000);
    return () => { if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [running, elapsed]);

  // Sync refs & persist
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { persistTimerState(running, elapsedRef.current); }, [running, persistTimerState]);
  useEffect(() => { if (!running) persistTimerState(false, elapsed); }, [elapsed, persistTimerState, running]);

  // Periodic persist while running
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      persistTimerState(true, Date.now() - (startRef.current ?? Date.now()));
    }, 15000);
    return () => window.clearInterval(id);
  }, [running, persistTimerState]);

  // Persist on visibility change / unload
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persist = () => persistTimerState(running, running ? Date.now() - (startRef.current ?? Date.now()) : elapsed);
    const onVisChange = () => { if (document.visibilityState === "hidden") persist(); };
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [elapsed, persistTimerState, running]);

  const start = useCallback(() => { setRunning(true); setIsFocusModeOpen(true); }, []);
  const pause = useCallback(() => { setRunning(false); }, []);
  const resume = useCallback(() => { setRunning(true); }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (elapsed > 1000) {
      const session: StudySession = {
        id: crypto.randomUUID(),
        start: new Date(Date.now() - elapsed).toISOString(),
        end: new Date().toISOString(),
        durationMs: elapsed,
        topicId: activeTopicId ?? null,
        subject: activeSubject ?? null,
      };
      onSessionEnd(session);
    }
    setElapsed(0);
    startRef.current = null;
    setIsFocusModeOpen(false);
    if (typeof window !== "undefined") window.localStorage.removeItem(TIMER_STORAGE_KEY);
  }, [elapsed, onSessionEnd, activeTopicId, activeSubject]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    startRef.current = null;
    setIsFocusModeOpen(false);
    if (typeof window !== "undefined") window.localStorage.removeItem(TIMER_STORAGE_KEY);
  }, []);

  const openFocusMode = useCallback(() => setIsFocusModeOpen(true), []);
  const closeFocusMode = useCallback(() => setIsFocusModeOpen(false), []);

  const formattedTime = useMemo(() => {
    const totalSec = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsed]);

  return {
    running, elapsed, formattedTime, isFocusModeOpen,
    start, pause, resume, stop, reset,
    openFocusMode, closeFocusMode,
  };
}
