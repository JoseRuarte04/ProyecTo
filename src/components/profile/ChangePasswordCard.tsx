import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  email: string;
}

export default function ChangePasswordCard({ email }: Props) {
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSave = current !== "" && next.length >= 6 && confirm !== "";

  const handleSave = async () => {
    if (next.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);

    // Verificar la contraseña actual antes de cambiarla: evita que una sesión
    // abierta cambie la clave sin conocerla, y renueva la sesión (mitiga el
    // requisito de reautenticación reciente de updateUser).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setSaving(false);
      toast.error("La contraseña actual es incorrecta");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setSaving(false);
      const msg = error.message.includes("different from the old")
        ? "La nueva contraseña debe ser distinta de la actual"
        : error.message;
      toast.error("Error al cambiar la contraseña", { description: msg });
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setSaving(false);
    toast.success("Contraseña actualizada");
  };

  return (
    <section className="dashboard-card p-5 sm:p-6 space-y-4">
      <p className="field-label">Contraseña</p>

      <div className="space-y-2">
        <Label>Contraseña actual</Label>
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nueva contraseña</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label>Confirmar nueva contraseña</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !canSave} className="min-w-[160px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar contraseña"}
        </Button>
      </div>
    </section>
  );
}
