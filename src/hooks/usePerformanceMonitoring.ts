import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  cls: number | null; // Cumulative Layout Shift
  fid: number | null; // First Input Delay
  ttfb: number | null; // Time to First Byte
  domContentLoaded: number | null;
  windowLoad: number | null;
}

const performanceMetrics: PerformanceMetrics = {
  fcp: null,
  lcp: null,
  cls: null,
  fid: null,
  ttfb: null,
  domContentLoaded: null,
  windowLoad: null,
};

/**
 * Sends performance metrics to monitoring service
 */
function reportMetrics(metrics: PerformanceMetrics) {
  if (typeof window === "undefined") return;

  // Send to your analytics/monitoring service
  const payload = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    metrics,
    userAgent: navigator.userAgent,
  };

  // Use fetch with keepalive to ensure it sends even if page unloads
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/metrics", JSON.stringify(payload));
  } else {
    fetch("/api/metrics", {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      // Silently fail - don't disrupt app
    });
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.debug("Performance Metrics:", metrics);
  }
}

/**
 * Hook to monitor Web Vitals and performance metrics
 */
export function usePerformanceMonitoring() {
  const metricsRef = useRef<PerformanceMetrics>(performanceMetrics);

  useEffect(() => {
    // Observe Core Web Vitals
    try {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metricsRef.current.lcp = lastEntry.renderTime || lastEntry.loadTime;
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).hadRecentInput) continue;
          clsValue += (entry as any).value;
          metricsRef.current.cls = clsValue;
        }
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });

      // First Input Delay (FID) - deprecated but still useful
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metricsRef.current.fid = (entry as any).processingDuration;
        }
      });
      fidObserver.observe({ entryTypes: ["first-input"] });

      // First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            metricsRef.current.fcp = entry.startTime;
          }
        }
      });
      fcpObserver.observe({ entryTypes: ["paint"] });

      return () => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
        fidObserver.disconnect();
        fcpObserver.disconnect();
      };
    } catch (error) {
      console.error("Performance monitoring error:", error);
    }
  }, []);

  // Track navigation timing
  useEffect(() => {
    const onPageLoad = () => {
      const perfData = window.performance.timing;
      metricsRef.current.domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
      metricsRef.current.windowLoad = perfData.loadEventEnd - perfData.navigationStart;
      metricsRef.current.ttfb = perfData.responseStart - perfData.navigationStart;

      // Report when page is fully loaded
      reportMetrics(metricsRef.current);
    };

    if (document.readyState === "complete") {
      onPageLoad();
    } else {
      window.addEventListener("load", onPageLoad);
      return () => window.removeEventListener("load", onPageLoad);
    }
  }, []);

  return metricsRef.current;
}

/**
 * Component for visualizing performance metrics (development only)
 */
export function PerformanceMonitor() {
  const metrics = usePerformanceMonitoring();

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-gray-100 text-xs p-3 rounded-lg shadow-lg font-mono max-w-xs">
      <div className="font-semibold mb-2 text-blue-400">Performance Metrics</div>
      <div className="space-y-1">
        {metrics.fcp && <div>FCP: {metrics.fcp.toFixed(0)}ms</div>}
        {metrics.lcp && <div>LCP: {metrics.lcp.toFixed(0)}ms</div>}
        {metrics.cls && <div>CLS: {metrics.cls.toFixed(3)}</div>}
        {metrics.fid && <div>FID: {metrics.fid.toFixed(0)}ms</div>}
        {metrics.ttfb && <div>TTFB: {metrics.ttfb.toFixed(0)}ms</div>}
        {metrics.domContentLoaded && (
          <div>DCL: {metrics.domContentLoaded.toFixed(0)}ms</div>
        )}
        {metrics.windowLoad && <div>Load: {metrics.windowLoad.toFixed(0)}ms</div>}
      </div>
    </div>
  );
}
