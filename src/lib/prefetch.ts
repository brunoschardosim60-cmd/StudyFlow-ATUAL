/**
 * Intelligent route prefetching with limits and cancellation.
 * - Max 2 concurrent prefetches per context
 * - Cancellable via AbortController pattern
 * - Priority-based loading
 */

const routeImports: Record<string, () => Promise<unknown>> = {
  "/notebooks": () => import("@/pages/Notebooks"),
  "/redacao": () => import("@/pages/Redacao"),
  "/analise": () => import("@/pages/Analise"),
  "/admin": () => import("@/pages/Admin"),
};

const featureImports: Record<string, () => Promise<unknown>> = {
  flora: () => import("@/components/FloraChatPanel"),
  quiz: () => import("@/components/QuizDialog"),
  notes: () => import("@/components/TopicNotesDialog"),
  focus: () => import("@/components/FocusModeOverlay"),
  weekly: () => import("@/components/WeeklySchedule"),
};

const prefetched = new Set<string>();
let activeContext: string | null = null;
let pendingIds: number[] = [];

function safePrefetch(key: string, loader: () => Promise<unknown>) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  loader().catch(() => { prefetched.delete(key); });
}

/** Cancel any pending context prefetches (user navigated away fast). */
function cancelPending() {
  pendingIds.forEach((id) => cancelIdleCallback(id));
  pendingIds = [];
}

export function prefetchRoute(path: string) {
  const loader = routeImports[path];
  if (loader) safePrefetch(`route:${path}`, loader);
}

export function prefetchFeature(feature: keyof typeof featureImports) {
  const loader = featureImports[feature];
  if (loader) safePrefetch(`feature:${feature}`, loader);
}

/** Idle prefetch — only Flora (highest priority). */
export function startIdlePrefetch() {
  const schedule = typeof requestIdleCallback !== "undefined"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 2500) as unknown as number;

  schedule(() => {
    safePrefetch("feature:flora", () => import("@/components/FloraChatPanel"));
  });
}

/**
 * Contextual prefetch: max 2 items per page, cancels on re-call.
 * Priority: only the most probable next actions.
 */
export function prefetchForContext(currentPage: "dashboard" | "redacao" | "notebooks" | "analise") {
  // Cancel previous context prefetches if user switched pages fast
  cancelPending();
  activeContext = currentPage;

  const schedule = typeof requestIdleCallback !== "undefined"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1500) as unknown as number;

  const id = schedule(() => {
    // Guard: user may have already navigated away
    if (activeContext !== currentPage) return;

    switch (currentPage) {
      case "dashboard":
        // Flora is #1 action from dashboard
        safePrefetch("feature:flora", () => import("@/components/FloraChatPanel"));
        safePrefetch("feature:focus", () => import("@/components/FocusModeOverlay"));
        break;
      case "redacao":
        // Flora for correction feedback
        safePrefetch("feature:flora", () => import("@/components/FloraChatPanel"));
        break;
      case "notebooks":
        safePrefetch("feature:notes", () => import("@/components/TopicNotesDialog"));
        break;
      case "analise":
        safePrefetch("route:/redacao", () => import("@/pages/Redacao"));
        break;
    }
  });

  pendingIds.push(id as number);
}
