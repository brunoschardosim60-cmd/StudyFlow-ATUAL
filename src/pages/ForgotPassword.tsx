import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Email de recuperação enviado!");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao enviar email"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Recuperar senha</h1>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          {sent ? (
            <p className="text-sm text-center text-muted-foreground">
              Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar link
              </Button>
            </form>
          )}
          <Link to="/auth" className="text-sm text-primary hover:underline block text-center">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
