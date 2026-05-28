import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [session, setSession]               = useState<Session | null>(null);
  const [loading, setLoading]               = useState(true);
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [done, setDone]                     = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    // Supabase procesa automáticamente el hash de la URL (#access_token=...&type=invite)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    toast.success("Contraseña configurada correctamente");
    setTimeout(() => navigate("/dashboard"), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de invitación no es válido o ya fue utilizado.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
            Ir al inicio de sesión
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">¡Todo listo!</h1>
          <p className="text-sm text-muted-foreground">Tu contraseña fue configurada. Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="text-center pb-4 pt-10">
          <h1 className="font-serif text-3xl font-semibold text-foreground tracking-tight">RehabOT</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Bienvenido/a. Configurá tu contraseña para acceder al sistema.
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={handleSetPassword} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[13px]">Correo electrónico</Label>
              <Input
                type="email"
                value={session.user.email ?? ""}
                disabled
                className="h-12 bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px]">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                minLength={6}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[13px]">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repetí tu contraseña"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                required
                className="h-12"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-[15px]" disabled={submitting}>
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Confirmar y acceder"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
