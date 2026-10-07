import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { acceptPrivacyPolicy } from "@/lib/privacyPolicy";

interface InvitationData {
  valid: boolean;
  email?: string;
  team_name?: string;
  expires_at?: string;
  reason?: string;
}

export default function InvitationRegister() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const token     = params.get("invitation");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading]       = useState(true);

  const [fullName, setFullName]   = useState("");
  const [password, setPassword]   = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvitation({ valid: false, reason: "not_found" });
      setLoading(false);
      return;
    }
    supabase.rpc("get_invitation_by_token", { p_token: token }).then(({ data, error: rpcErr }) => {
      if (rpcErr) {
        setInvitation({ valid: false, reason: "not_found" });
      } else {
        setInvitation(data as unknown as InvitationData);
      }
      setLoading(false);
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.email) return;
    setSubmitting(true);
    setError(null);

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpErr) {
      setSubmitting(false);
      setError(signUpErr.message);
      return;
    }

    // Puede no haber sesión todavía si el proyecto exige confirmar el email antes
    // de loguear — en ese caso el gate de AppLayout.tsx cubre el registro del
    // consentimiento en el primer login real.
    if (signUpData.session?.user?.id) {
      await acceptPrivacyPolicy(signUpData.session.user.id);
    }

    setSubmitting(false);
    setDone(true);
  };

  const reasonLabel: Record<string, string> = {
    not_found: "El enlace de invitación no es válido.",
    expired:   "Esta invitación ya venció.",
    accepted:  "Esta invitación ya fue utilizada.",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invitation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Invitación inválida</h1>
          <p className="text-sm text-muted-foreground">
            {reasonLabel[invitation?.reason ?? "not_found"] ?? "El enlace de invitación no es válido."}
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
          <h1 className="text-xl font-semibold text-foreground">¡Cuenta creada!</h1>
          <p className="text-sm text-muted-foreground">
            Revisá tu correo <strong>{invitation.email}</strong> para confirmar tu cuenta.
            Una vez confirmada vas a estar dentro del equipo <strong>{invitation.team_name}</strong>.
          </p>
          <Button size="sm" onClick={() => navigate("/login")}>
            Ir al inicio de sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="font-serif text-2xl font-semibold text-foreground">HisTO</p>
          <p className="text-sm text-muted-foreground">
            Te invitaron a unirte al equipo <strong>{invitation.team_name}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={invitation.email}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Tu nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="acceptedPrivacy"
              checked={acceptedPrivacy}
              onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
            />
            <Label htmlFor="acceptedPrivacy" className="text-[13px] font-normal leading-snug text-muted-foreground">
              Leí y acepto la{" "}
              <Link to="/privacidad" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                política de privacidad
              </Link>
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting || !acceptedPrivacy}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear cuenta y aceptar invitación
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Iniciá sesión
          </button>
        </p>
      </div>
    </div>
  );
}
