// StudyFlow Service Worker — notificações push de revisões agendadas
// v2: inclui scheduling de revisões via IndexedDB + push periódico

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ─── Click em notificação → abre o app ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE", url });
          return;
        }
      }
      if (self.clients.openWindow) self.clients.openWindow(url);
    })
  );
});

// ─── Mensagens da página principal ───────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SCHEDULE_REVIEW_NOTIFICATIONS") {
    scheduleReviewChecks(event.data.reviews);
  }
  if (event.data?.type === "SHOW_NOTIFICATION") {
    showStudyNotification(event.data.title, event.data.body, event.data.url);
  }
});

function showStudyNotification(title, body, url = "/") {
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/favicon.ico",
    tag: "studyflow-revision",
    renotify: true,
    data: { url },
    actions: [
      { action: "open", title: "Revisar agora" },
      { action: "dismiss", title: "Mais tarde" },
    ],
  });
}

// Armazena revisões pendentes em memória (limpa ao fechar o SW)
let _pendingReviews = [];

function scheduleReviewChecks(reviews) {
  _pendingReviews = reviews || [];
  console.log("[SW] Revisões agendadas:", _pendingReviews.length);
}

// Verifica revisões atrasadas a cada 30 minutos (via sync periódico se disponível)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "studyflow-revision-check") {
    event.waitUntil(checkOverdueReviews());
  }
});

async function checkOverdueReviews() {
  const today = new Date().toISOString().split("T")[0];
  const overdue = _pendingReviews.filter(r => !r.completed && r.scheduled_date <= today);
  if (overdue.length > 0) {
    const subjects = [...new Set(overdue.map(r => r.materia))].slice(0, 3).join(", ");
    showStudyNotification(
      `${overdue.length} revisão${overdue.length > 1 ? "ões" : ""} pendente${overdue.length > 1 ? "s" : ""}`,
      `Matérias: ${subjects}. Não quebre sua sequência!`,
      "/"
    );
  }
}
