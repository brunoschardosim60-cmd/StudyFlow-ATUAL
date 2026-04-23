import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FocusMiniPlayer } from "./FocusMiniPlayer";
import { loadJsonStorage } from "@/lib/storage";

const TIMER_STORAGE_KEY = "studyflow.timer.v1";

interface TimerSnapshot {
  running: boolean;
  elapsed: number;
  savedAt: number;
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GlobalFocusMiniPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Don't render on main dashboard — Index.tsx already handles it
  const isIndex = location.pathname === "/";

  useEffect(() => {
    if (isIndex) return;

    const read = () => {
      const saved = loadJsonStorage<TimerSnapshot>(TIMER_STORAGE_KEY);
      if (!saved) {
        setRunning(false);
        setElapsed(0);
        return;
      }
      if (saved.running) {
        setRunning(true);
        setElapsed(saved.elapsed + Math.max(0, Date.now() - saved.savedAt));
      } else {
        setRunning(false);
        setElapsed(saved.elapsed || 0);
      }
    };

    read();
    const id = window.setInterval(read, 1000);
    return () => window.clearInterval(id);
  }, [isIndex]);

  if (isIndex) return null;

  const visible = running || elapsed > 0;

  return (
    <FocusMiniPlayer
      visible={visible}
      formattedTime={formatElapsed(elapsed)}
      running={running}
      onOpen={() => navigate("/")}
    />
  );
}
