import { useState } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MotivationalQuote() {
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setVisible(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-motivation", {
        body: {},
      });
      if (error) throw error;
      setQuote(data.quote || "Continue estudando, você está no caminho certo!");
    } catch {
      toast.error("Erro ao gerar frase motivacional.");
      setQuote("Cada hora de estudo te aproxima do seu objetivo. 💪");
    } finally {
      setLoading(false);
    }
  };

  if (!visible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={generate}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Motivação
      </Button>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 flex items-start gap-3 relative">
      <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
      <p className="text-sm italic text-foreground/80 flex-1">
        {loading ? "Gerando frase motivacional..." : `"${quote}"`}
      </p>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" onClick={generate} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" onClick={() => setVisible(false)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
