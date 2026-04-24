import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloraIcon } from "@/components/FloraIcon";
import { Mail, Lock, User, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, BookOpen } from "lucide-react";
import { toast } from "sonner";
import heroIllustration from "@/assets/study-hero-illustration.png";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/* ─── Motivational quotes ─── */
const QUOTES = [
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "A educação é a arma mais poderosa que você pode usar para mudar o mundo.", author: "Nelson Mandela" },
  { text: "O segredo de progredir é começar.", author: "Mark Twain" },
];

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const quote = QUOTES[0];

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
      toast.error(getErrorMessage(error, "Erro na autenticação"));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error(getErrorMessage(result.error, `Erro ao entrar com ${provider}`));
        return;
      }

      if (result.redirected) return;

      navigate("/", { replace: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, `Erro ao entrar com ${provider}`));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      {/* ─── Left: Hero ─── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-16 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-20 bg-[hsl(var(--primary))]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 bg-[hsl(280,60%,55%)]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[hsl(var(--primary-foreground))]" />
          </div>
          <div>
            <span className="font-bold text-lg text-[hsl(var(--foreground))] font-['Space_Grotesk']">StudyFlow</span>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Seu plano de estudos inteligente</p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-6 -mt-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.15)]">
            <FloraIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-medium text-[hsl(var(--primary))]">Foco. Organização. Evolução.</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-[hsl(var(--foreground))] font-['Space_Grotesk'] leading-tight">
            Transforme seus<br />
            estudos em{" "}
            <span className="text-[hsl(var(--primary))]">resultados.</span>
          </h1>

          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-md leading-relaxed">
            Planeje, estude, revise e acompanhe seu progresso com a ajuda da Flora, sua IA parceira.
          </p>

          {/* Illustration */}
          <div className="flex justify-center pt-2">
            <img
              src={heroIllustration}
              alt="Ilustração de materiais de estudo com caderno, gráficos e checklist"
              width={480}
              height={380}
              className="max-w-md w-full h-auto drop-shadow-lg"
            />
          </div>
        </div>

        {/* Quote */}
        <div className="relative z-10 flex items-start gap-3 max-w-md">
          <span className="text-4xl font-serif text-[hsl(var(--muted-foreground)/0.3)] leading-none select-none">"</span>
          <div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] italic leading-relaxed">
              {quote.text}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground)/0.6)] mt-1">— {quote.author}</p>
          </div>
        </div>
      </div>

      {/* ─── Right: Auth form ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          {/* Flora avatar + welcome */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--primary))] mx-auto">
              <FloraIcon className="w-7 h-7 text-[hsl(var(--primary-foreground))]" />
            </div>
            <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] font-['Space_Grotesk']">
              {mode === "login" ? "Bem-vindo de volta!" : "Crie sua conta"}
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {mode === "login"
                ? "Faça login para continuar sua jornada"
                : "Comece sua jornada de estudos agora"}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:p-8 space-y-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Nome
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground)/0.5)]" />
                    <Input
                      id="name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      className="pl-11 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground)/0.5)]" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="pl-11 h-12 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground)/0.5)]" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="pl-11 pr-11 h-12 rounded-xl"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <Link
                  to="/forgot-password"
                  className="text-sm text-[hsl(var(--primary))] hover:underline block text-right font-medium"
                >
                  Esqueci minha senha
                </Link>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? "Entrar" : "Criar conta"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[hsl(var(--border))]" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">ou</span>
              <div className="flex-1 h-px bg-[hsl(var(--border))]" />
            </div>

            {/* Social logins */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("google")}
                disabled={!!socialLoading}
                className="w-full h-12 rounded-xl text-sm font-medium"
              >
                {socialLoading === "google" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuar com Google
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("apple")}
                disabled={!!socialLoading}
                className="w-full h-12 rounded-xl text-sm font-medium"
              >
                {socialLoading === "apple" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Continuar com Apple
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Toggle mode */}
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-[hsl(var(--primary))] hover:underline font-semibold"
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground)/0.6)]">
            <ShieldCheck className="w-4 h-4" />
            <span>Seus dados estão protegidos com segurança de ponta a ponta.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
