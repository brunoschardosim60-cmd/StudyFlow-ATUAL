import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePerformanceMonitoring } from "../usePerformanceMonitoring";

describe("usePerformanceMonitoring", () => {
  beforeEach(() => {
    // Mock performance APIs
    vi.clearAllMocks();

    // Mock PerformanceObserver
    global.PerformanceObserver = vi.fn(function (callback) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      return this;
    }) as any;
  });

  it("initializes with null metrics", () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    expect(result.current).toMatchObject({
      fcp: null,
      lcp: null,
      cls: null,
      fid: null,
      ttfb: null,
      domContentLoaded: null,
      windowLoad: null,
    });
  });

  it("creates performance observers", () => {
    const observerSpy = vi.fn();
    global.PerformanceObserver = vi.fn(() => ({
      observe: observerSpy,
      disconnect: vi.fn(),
    })) as any;

    renderHook(() => usePerformanceMonitoring());

    expect(global.PerformanceObserver).toHaveBeenCalled();
  });

  it("tracks navigation timing on page load", async () => {
    const mockTiming = {
      navigationStart: 0,
      responseStart: 100,
      domContentLoadedEventEnd: 500,
      loadEventEnd: 1000,
    };

    Object.defineProperty(window.performance, "timing", {
      value: mockTiming,
      configurable: true,
    });

    const { result } = renderHook(() => usePerformanceMonitoring());

    // Simulate page load
    window.dispatchEvent(new Event("load"));

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.ttfb).toBe(100);
    expect(result.current.domContentLoaded).toBe(500);
    expect(result.current.windowLoad).toBe(1000);
  });

  it("handles missing performance APIs gracefully", () => {
    const oldPerformanceObserver = global.PerformanceObserver;
    // @ts-ignore
    delete global.PerformanceObserver;

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

    expect(() => {
      renderHook(() => usePerformanceMonitoring());
    }).not.toThrow();

    consoleErrorSpy.mockRestore();
    global.PerformanceObserver = oldPerformanceObserver;
  });

  it("reports metrics via beacon or fetch", async () => {
    const beaconSpy = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);

    const mockTiming = {
      navigationStart: 0,
      responseStart: 100,
      domContentLoadedEventEnd: 500,
      loadEventEnd: 1000,
    };

    Object.defineProperty(window.performance, "timing", {
      value: mockTiming,
      configurable: true,
    });

    renderHook(() => usePerformanceMonitoring());

    window.dispatchEvent(new Event("load"));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(beaconSpy).toHaveBeenCalledWith(
      "/api/metrics",
      expect.stringContaining("ttfb")
    );

    beaconSpy.mockRestore();
  });

  it("logs metrics to console in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation();

    renderHook(() => usePerformanceMonitoring());

    expect(consoleDebugSpy).toHaveBeenCalled();

    consoleDebugSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
