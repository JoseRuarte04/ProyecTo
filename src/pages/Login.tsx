import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowLeft, MailCheck, Users, CalendarCheck, Dumbbell, ClipboardList } from "lucide-react";

type Mode = "login" | "forgot" | "forgot_sent";

const FEATURES = [
  { icon: Users, text: "Historia clínica y sesiones de tus pacientes" },
  { icon: CalendarCheck, text: "Agenda de turnos del consultorio" },
  { icon: ClipboardList, text: "Evaluaciones funcionales y analíticas" },
  { icon: Dumbbell, text: "Planes de ejercicios para el hogar" },
];

export default function Login() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Error al iniciar sesión", {
        description: "Correo o contraseña incorrectos.",
      });
    }
    setSubmitting(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo enviar el correo", { description: error.message });
      return;
    }
    setMode("forgot_sent");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel de marca — desktop */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] max-w-[560px] bg-primary text-primary-foreground p-12">
        <div>
          <p className="font-serif text-2xl font-semibold tracking-tight">RehabOT</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/60 mt-1">
            Clínica · Terapia Ocupacional
          </p>
        </div>

        <div className="space-y-10">
          <h2 className="font-serif text-[2.5rem] leading-[1.15] font-medium tracking-tight">
            La gestión clínica de tu consultorio, en un solo lugar.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-primary-foreground/80">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-foreground/10 shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} RehabOT
        </p>
      </div>

      {/* Panel de formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo — mobile/tablet */}
          <div className="lg:hidden text-center mb-10">
            <p className="font-serif text-3xl font-semibold text-foreground tracking-tight">RehabOT</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mt-1">
              Clínica · Terapia Ocupacional
            </p>
          </div>

          {mode === "login" && (
            <>
              <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Iniciar sesión</h1>
              <p className="text-sm text-muted-foreground mt-1.5 mb-8">
                Ingresá con tu cuenta profesional.
              </p>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px]">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[13px]">Contraseña</Label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-[15px]" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
                </Button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <button
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Recuperar contraseña</h1>
              <p className="text-sm text-muted-foreground mt-1.5 mb-8">
                Ingresá tu correo y te enviamos un link para crear una contraseña nueva.
              </p>

              <form onSubmit={handleForgot} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-[13px]">Correo electrónico</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-[15px]" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar instrucciones"}
                </Button>
              </form>
            </>
          )}

          {mode === "forgot_sent" && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex items-center justify-center h-14 w-14 rounded-full bg-success/10">
                <MailCheck className="h-7 w-7 text-success" />
              </div>
              <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Revisá tu correo</h1>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Si existe una cuenta con <span className="font-medium text-foreground">{email}</span>,
                vas a recibir un link para restablecer tu contraseña. Revisá también la carpeta de spam.
              </p>
              <Button variant="outline" className="mt-8 w-full h-11" onClick={() => setMode("login")}>
                Volver a iniciar sesión
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
