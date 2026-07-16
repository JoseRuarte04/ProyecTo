import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  profile: {
    id: string;
    full_name: string;
    specialty: string | null;
    license_number: string | null;
    avatar_url: string | null;
  };
}

export default function PersonalDataCard({ profile }: Props) {
  const { refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name,
    specialty: profile.specialty || "",
    license_number: profile.license_number || "",
  });

  const canSave = form.full_name.trim() !== "";

  const handleSave = async () => {
    if (!canSave) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        specialty: form.specialty.trim() || null,
        license_number: form.license_number.trim() || null,
      })
      .eq("id", profile.id);
    if (error) {
      setSaving(false);
      toast.error("Error al guardar los cambios", { description: error.message });
      return;
    }
    await refreshProfile();
    setSaving(false);
    toast.success("Datos actualizados");
  };

  return (
    <section className="dashboard-card p-5 sm:p-6 space-y-4">
      <p className="field-label">Datos personales</p>

      <div className="space-y-2">
        <Label>Nombre completo *</Label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="ej: María González"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Especialidad</Label>
          <Input
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            placeholder="ej: Terapia ocupacional"
          />
        </div>
        <div className="space-y-2">
          <Label>Matrícula</Label>
          <Input
            value={form.license_number}
            onChange={(e) => setForm({ ...form, license_number: e.target.value })}
            placeholder="ej: MN 12345"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !canSave} className="min-w-[140px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
        </Button>
      </div>
    </section>
  );
}
