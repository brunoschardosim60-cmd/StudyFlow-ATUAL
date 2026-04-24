import { useLocation, useNavigate } from "react-router-dom";
import { Home, NotebookPen, FileText, BarChart3, Sparkles } from "lucide-react";

const items = [
  { path: "/", label: "Início", icon: Home },
  { path: "/notebooks", label: "Cadernos", icon: NotebookPen },
  { path: "flora", label: "Flora", icon: Sparkles, isAction: true },
  { path: "/redacao", label: "Redação", icon: FileText },
  { path: "/analise", label: "Análise", icon: BarChart3 },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around h-14 px-1">
        {items.map((item) => {
          const isFloraAction = (item as any).isAction;
          const active = !isFloraAction && location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                if (isFloraAction) {
                  window.dispatchEvent(new CustomEvent("open-flora-chat"));
                } else {
                  navigate(item.path);
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors ${
                isFloraAction
                  ? "text-primary"
                  : active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
