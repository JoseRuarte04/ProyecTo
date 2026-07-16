import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

interface Props {
  email: string;
}

export default function ChangeEmailCard({ email }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  // user.new_email queda seteado mientras hay un cambio de email sin confirmar
  const [pendingEmail, setPendingEmail] = useState<string | null>(user?.new_email ?? null);

  const canSave = newEmail.trim() !== "" && newEmail.trim().toLowerCase() !== email.toLowerCase();

  const handleSave = async () => {
    const target = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      toast.error("Ingresá un email válido");
      return;
    }
    setSaving(true);
    // El emailRedirectTo debe estar en la allowlist de Redirect URLs del
    // proyecto Supabase; si no, el link del mail cae en el Site URL.
    const { error } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/profile` },
    );
    setSaving(false);
    if (error) {
      toast.error("Error al cambiar el email", { description: error.message });
      return;
    }
    setPendingEmail(target);
    setNewEmail("");
    toast.success("Correo de confirmación enviado");
  };

  return (
    <section className="dashboard-card p-5 sm:p-6 space-y-4">
      <p className="field-label">Email de acceso</p>

      <div className="space-y-2">
        <Label>Email actual</Label>
        <Input value={email} disabled />
      </div>

      {pendingEmail && (
        <Alert>
          <MailCheck className="h-4 w-4" />
          <AlertDescription>
            Hay un cambio de email pendiente a <strong>{pendingEmail}</strong>. Te enviamos
            correos de confirmación a la casilla actual y a la nueva; el cambio se aplica
            cuando confirmes desde el enlace.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Nuevo email</Label>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="nuevo@email.com"
          autoComplete="email"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !canSave} className="min-w-[140px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar email"}
        </Button>
      </div>
    </section>
  );
}
