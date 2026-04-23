import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Mail, Lock, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Confira seu email para confirmar o cadastro.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
        return;
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro na autenticacao"));
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
          <h1 className="font-heading text-2xl font-bold">StudyFlow</h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login" ? "Entre para continuar seus estudos." : "Crie sua conta para salvar seu progresso."}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="pl-10"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {mode === "login" && (
              <Link to="/forgot-password" className="text-xs text-primary hover:underline block text-right">
                Esqueci minha senha
              </Link>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>

        <button
          onClick={() => navigate("/")}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Continuar sem entrar
        </button>
      </div>
    </div>
  );
}
