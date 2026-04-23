import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudyTimer } from "@/hooks/useStudyTimer";

class MockAudio {
  src = "";
  loop = false;
  preload = "";
  volume = 1;
  paused = true;

  load() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

describe("useStudyTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00.000Z"));
    localStorage.clear();
    vi.stubGlobal("Audio", MockAudio as unknown as typeof Audio);
    vi.stubGlobal("crypto", {
      randomUUID: () => "session-1",
    });
  });

  it("mantém timer rodando e gera sessão no stop", () => {
    const onSessionEnd = vi.fn();

    const { result } = renderHook(() =>
      useStudyTimer({
        onSessionEnd,
        activeTopicId: "topic-1",
        activeSubject: "Matemática",
      })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.running).toBe(true);
    expect(result.current.elapsed).toBeGreaterThanOrEqual(5000);

    act(() => {
      result.current.stop();
    });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(onSessionEnd.mock.calls[0][0]).toMatchObject({
      id: "session-1",
      topicId: "topic-1",
      subject: "Matemática",
    });
    expect(result.current.elapsed).toBe(0);
  });
});
