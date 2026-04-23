import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const finishOAuth = async () => {
      try {
        // A sessão pode levar alguns instantes para ser gravada após o redirect OAuth.
        let session = (await supabase.auth.getSession()).data.session;
        if (!session) {
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            session = (await supabase.auth.getSession()).data.session;
            if (session) break;
          }
        }

        navigate(session ? "/" : "/auth", { replace: true });
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Erro ao finalizar login com Google"));
        navigate("/auth", { replace: true });
      }
    };

    finishOAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
