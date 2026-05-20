import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Therapist {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  license_number: string | null;
}

interface Props {
  therapist: Therapist;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Pick<Therapist, "id" | "full_name" | "email" | "specialty" | "license_number">) => void;
}

export function TherapistEditDialog({ therapist, open, onClose, onSaved }: Props) {
  const [fullName, setFullName]   = useState(therapist.full_name);
  const [email, setEmail]         = useState(therapist.email);
  const [specialty, setSpecialty] = useState(therapist.specialty ?? "");
  const [license, setLicense]     = useState(therapist.license_number ?? "");
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_therapist", {
      p_user_id:   therapist.id,
      p_full_name: fullName.trim(),
      p_email:     email.trim(),
      p_specialty: specialty.trim() || null,
      p_license:   license.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Error al guardar: " + error.message);
      return;
    }
    toast.success("Datos actualizados");
    onSaved({
      id:             therapist.id,
      full_name:      fullName.trim(),
      email:          email.trim(),
      specialty:      specialty.trim() || null,
      license_number: license.trim() || null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar terapista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Especialidad</Label>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="h-9 text-sm" placeholder="Ej: Terapia Ocupacional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Matrícula</Label>
            <Input value={license} onChange={(e) => setLicense(e.target.value)} className="h-9 text-sm" placeholder="Ej: MN12345" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
