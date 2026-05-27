import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function InviteTherapistDialog({ open, onClose, onInvited }: Props) {
  const [email, setEmail]         = useState("");
  const [fullName, setFullName]   = useState("");
  const [specialty, setSpecialty] = useState("");
  const [license, setLicense]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const reset = () => {
    setEmail(""); setFullName(""); setSpecialty(""); setLicense(""); setErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  const handleInvite = async () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) {
      errs.email = "El email es obligatorio";
    } else if (!isValidEmail(email)) {
      errs.email = "Ingresá un email válido (ej: terapeuta@dominio.com)";
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-therapist`,
      {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email:          email.trim().toLowerCase(),
          full_name:      fullName.trim() || null,
          specialty:      specialty.trim() || null,
          license_number: license.trim() || null,
        }),
      }
    );

    setSaving(false);
    const body = await res.json();

    if (!res.ok || body.error) {
      toast.error(body.error || "Error al enviar la invitación");
      return;
    }

    toast.success(`Invitación enviada a ${email.trim()}`);
    reset();
    onInvited();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar terapista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({}); }}
              className={`h-9 text-sm${errors.email ? " border-destructive ring-1 ring-destructive" : ""}`}
              placeholder="terapeuta@email.com"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            {errors.email
              ? <p className="text-xs text-destructive">{errors.email}</p>
              : <p className="text-[11px] text-muted-foreground">Recibirá un email con un link para configurar su contraseña.</p>
            }
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre completo</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9 text-sm"
              placeholder="Ej: Ana García"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Especialidad</Label>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="h-9 text-sm"
                placeholder="Ej: T. Ocupacional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Matrícula</Label>
              <Input
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="h-9 text-sm"
                placeholder="Ej: MN12345"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleInvite} disabled={saving || !email.trim()} className="gap-1.5">
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Mail className="h-3.5 w-3.5" />}
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
