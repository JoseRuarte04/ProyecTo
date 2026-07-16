import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // debe coincidir con el límite del bucket
const AVATAR_MAX_DIMENSION = 512; // px — el avatar se muestra a 80px como mucho

// Las fotos de cámara pesan 4-8MB y el bucket admite 2MB: redimensionar y
// recomprimir en el navegador antes de subir.
async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      0.85,
    ),
  );
}

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    full_name: profile.full_name,
    specialty: profile.specialty || "",
    license_number: profile.license_number || "",
  });

  const canSave = form.full_name.trim() !== "";

  const initials =
    profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "TO";

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error("La foto debe ser JPG, PNG o WebP");
      return;
    }
    setUploading(true);

    let blob: Blob;
    try {
      blob = await compressAvatar(file);
    } catch {
      setUploading(false);
      toast.error("No se pudo procesar la imagen", {
        description: "Probá con otra foto en formato JPG o PNG.",
      });
      return;
    }
    if (blob.size > AVATAR_MAX_BYTES) {
      setUploading(false);
      toast.error("La foto sigue siendo demasiado pesada tras comprimirla");
      return;
    }

    // Filename con timestamp: reusar el mismo path haría que el CDN siga
    // sirviendo la imagen vieja aunque el archivo cambie.
    const path = `${profile.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (uploadError) {
      setUploading(false);
      toast.error("Error al subir la foto", { description: uploadError.message });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", profile.id);
    if (updateError) {
      setUploading(false);
      toast.error("Error al guardar la foto", { description: updateError.message });
      return;
    }

    // Borrar la foto anterior (best-effort: si falla queda huérfana, no bloquea)
    const oldPath = profile.avatar_url?.split("/avatars/")[1];
    if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);

    await refreshProfile();
    setUploading(false);
    toast.success("Foto actualizada");
  };

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

      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
          )}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              handleAvatarChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Camera className="h-4 w-4 mr-2" />Cambiar foto</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG o WebP — se ajusta automáticamente.</p>
        </div>
      </div>

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
