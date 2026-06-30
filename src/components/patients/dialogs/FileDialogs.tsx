import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const ALLOWED_CLINICAL_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
] as const;

export const CLINICAL_FILE_ACCEPT = ALLOWED_CLINICAL_FILE_TYPES.join(",");

export const isAllowedClinicalFileType = (type: string) =>
  ALLOWED_CLINICAL_FILE_TYPES.includes(type as (typeof ALLOWED_CLINICAL_FILE_TYPES)[number]);

interface UploadProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  userId: string;
  onSaved: () => void;
  episodeId: string | null;
}

export function UploadFileDialog({ open, onClose, patientId, userId, onSaved, episodeId }: UploadProps) {
  const [category, setCategory] = useState<string>("");
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setCategory(""); setPhotoDate(new Date().toISOString().split("T")[0]);
    setDescription(""); setFile(null); setFileError(""); onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFileError("");
    if (!f) { setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setFileError("El archivo supera los 50MB permitidos."); setFile(null); return; }
    if (!isAllowedClinicalFileType(f.type)) {
      setFileError("Formato no permitido. Usá JPG, PNG, WebP, GIF, PDF, MP4 o MOV.");
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const handleSave = async () => {
    if (!category || !file) return;
    if (!isAllowedClinicalFileType(file.type)) { toast.error("Formato de archivo no permitido"); return; }
    setSaving(true);
    const path = `${userId}/${patientId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("clinical-files").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error("Error al subir el archivo"); setSaving(false); return; }
    const { error } = await supabase.from("clinical_files").insert({
      patient_id: patientId, uploaded_by: userId, file_name: file.name,
      file_path: path, file_type: file.type, category: category as any,
      description: description || null, photo_date: photoDate, is_deleted: false,
      episode_id: episodeId ?? null,
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar el archivo"); return; }
    toast.success("Archivo guardado correctamente");
    resetAndClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar archivo</DialogTitle>
          <DialogDescription>Subí fotos de evolución, estudios o documentos del paciente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Foto de evolución</SelectItem>
                <SelectItem value="study">Estudio (Rx, RMN, eco...)</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Podés cambiar la fecha si la foto es de otro día</p>
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Semana 3 post-cirugía, dorso de mano..." />
          </div>
          <div className="space-y-2">
            <Label>Archivo *</Label>
            <Input type="file" accept={CLINICAL_FILE_ACCEPT} onChange={handleFileChange} />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !category || !file}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Subir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteFileProps {
  file: any;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeleteFileConfirm({ file, onClose, onDeleted }: DeleteFileProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("clinical_files").update({ is_deleted: true }).eq("id", file.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el archivo"); return; }
    toast.success("Archivo eliminado");
    onDeleted(file.id);
    onClose();
  };

  return (
    <AlertDialog open={!!file} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará "{file?.file_name}". Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
