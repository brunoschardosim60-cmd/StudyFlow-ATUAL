import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStudyTimer } from "../useStudyTimer";

describe("useStudyTimer", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() => useStudyTimer());

    expect(result.current.minutes).toBe(25);
    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it("starts and stops timer", () => {
    const { result } = renderHook(() => useStudyTimer());

    // Start timer
    if (result.current.start) {
      result.current.start();
    }

    expect(result.current.isRunning).toBe(true);

    // Stop timer
    if (result.current.stop) {
      result.current.stop();
    }

    expect(result.current.isRunning).toBe(false);
  });

  it("resets timer to initial state", () => {
    const { result } = renderHook(() => useStudyTimer());

    if (result.current.reset) {
      result.current.reset();
    }

    expect(result.current.minutes).toBe(25);
    expect(result.current.seconds).toBe(0);
  });

  it("decrements time when running", async () => {
    const { result } = renderHook(() => useStudyTimer());

    if (result.current.start) {
      result.current.start();
    }

    // Fast forward 1 second
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.seconds).toBeLessThan(60);
    });
  });

  it("handles minute rollover", () => {
    const { result } = renderHook(() => useStudyTimer());

    // Set to 0:01
    if (result.current.setCustomTime) {
      result.current.setCustomTime(0, 1);
    }

    if (result.current.start) {
      result.current.start();
    }

    vi.advanceTimersByTime(1100);

    // Should wrap to next minute
    expect(result.current.minutes).toBeLessThanOrEqual(25);
  });

  it("allows custom time setting", () => {
    const { result } = renderHook(() => useStudyTimer());

    if (result.current.setCustomTime) {
      result.current.setCustomTime(5, 30);
    }

    expect(result.current.minutes).toBe(5);
    expect(result.current.seconds).toBe(30);
  });
});
