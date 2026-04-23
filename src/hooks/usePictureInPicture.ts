import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mini floating timer via window.open() — full CSS control, premium look.
 */
export function usePictureInPicture() {
  const winRef = useRef<Window | null>(null);
  const [active, setActive] = useState(false);
  const updateRef = useRef({ time: "00:00:00", topic: "", running: false });

  // Send state to the popup
  const pushState = useCallback(() => {
    const w = winRef.current;
    if (!w || w.closed) return;
    w.postMessage(
      {
        type: "pip-update",
        time: updateRef.current.time,
        topic: updateRef.current.topic,
        running: updateRef.current.running,
      },
      "*",
    );
  }, []);

  const open = useCallback(
    async (_time: string, topic: string, isRunning: boolean) => {
      updateRef.current = { time: _time, topic, running: isRunning };

      // If already open, just focus
      if (winRef.current && !winRef.current.closed) {
        winRef.current.focus();
        setActive(true);
        pushState();
        return;
      }

      const w = window.open(
        "/pip-timer.html",
        "studyflow-pip",
        "width=300,height=56,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no",
      );

      if (!w) {
        throw new Error("Popup bloqueado pelo navegador. Permita popups para este site.");
      }

      winRef.current = w;
      setActive(true);

      // Wait for popup to signal ready, then push state
      const readyHandler = (e: MessageEvent) => {
        if (e.data?.type === "pip-ready") {
          window.removeEventListener("message", readyHandler);
          pushState();
        }
      };
      window.addEventListener("message", readyHandler);

      // Detect close
      const checkClosed = setInterval(() => {
        if (w.closed) {
          clearInterval(checkClosed);
          winRef.current = null;
          setActive(false);
        }
      }, 500);
    },
    [pushState],
  );

  const close = useCallback(() => {
    const w = winRef.current;
    if (w && !w.closed) {
      w.postMessage({ type: "pip-close" }, "*");
      w.close();
    }
    winRef.current = null;
    setActive(false);
  }, []);

  const update = useCallback(
    (time: string, topic: string, isRunning: boolean) => {
      updateRef.current = { time, topic, running: isRunning };
      pushState();
    },
    [pushState],
  );

  // Listen for actions from the popup (pause/resume/stop)
  const actionHandlerRef = useRef<((action: string) => void) | null>(null);

  const onAction = useCallback((handler: (action: string) => void) => {
    actionHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "pip-action" && actionHandlerRef.current) {
        actionHandlerRef.current(e.data.action);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const w = winRef.current;
      if (w && !w.closed) w.close();
    };
  }, []);

  return { open, close, update, active, isSupported: true, onAction };
}
