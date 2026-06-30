import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Image as ImageIcon, Trash2, Download, FileText } from "lucide-react";
import { UploadFileDialog, DeleteFileConfirm } from "@/components/patients/dialogs/FileDialogs";
import { DischargeReportModal } from "@/components/patients/DischargeReportModal";
import { useDischargeReport } from "@/hooks/useDischargeReport";

interface Props {
  clinicalFiles: any[];
  signedUrls: Record<string, string>;
  loadingUrls: boolean;
  patientId: string;
  userId: string;
  activeEpisodeId: string | null;
  hasSessions: boolean;
  patientName: string;
  session: any;
  onRefresh: () => void;
  onFileDeleted: (id: string) => void;
}

export function ArchivosTab({ clinicalFiles, signedUrls, loadingUrls, patientId, userId, activeEpisodeId, hasSessions, patientName, session, onRefresh, onFileDeleted }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [deleteFile, setDeleteFile] = useState<any>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; description?: string; date?: string } | null>(null);
  const [showDischargeReport, setShowDischargeReport] = useState(false);
  const dischargeReport = useDischargeReport(patientId, activeEpisodeId, session);

  const photos = clinicalFiles.filter(f => f.category === "photo");
  const docs = clinicalFiles.filter(f => f.category === "study" || f.category === "document");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Archivos clínicos</h3>
          <Button onClick={() => setShowUpload(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />Agregar archivo
          </Button>
        </div>
      </div>

      {/* Fotos de evolución */}
      <div>
        <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />Fotos de evolución
        </h3>
        {photos.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">Sin fotos de evolución. Agregá la primera foto.</p>
        ) : loadingUrls ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map(p => <Skeleton key={p.id} className="h-48 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map(p => (
              <div key={p.id} className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted">
                {signedUrls[p.id] ? (
                  <img
                    src={signedUrls[p.id]}
                    alt={p.description || p.file_name}
                    className="w-full h-48 object-cover cursor-zoom-in"
                    onClick={() => setLightboxPhoto({ url: signedUrls[p.id], description: p.description, date: p.photo_date })}
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center text-muted-foreground text-sm">Sin vista previa</div>
                )}
                <button
                  onClick={() => setDeleteFile(p)}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="p-2">
                  <p className="font-medium text-sm text-foreground">{format(new Date(p.photo_date), "dd/MM/yyyy")}</p>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/50" />

      {/* Documentos y estudios */}
      <div>
        <h3 className="font-medium text-foreground mb-3">Documentos y estudios</h3>
        {docs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">Sin documentos ni estudios.</p>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <Card key={d.id} className="border-border/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">{d.category === "study" ? "🔬" : "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{d.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.category === "study" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}>
                        {d.category === "study" ? "Estudio" : "Documento"}
                      </span>
                      <span className="text-xs text-muted-foreground">{format(new Date(d.photo_date), "dd/MM/yyyy")}</span>
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {signedUrls[d.id] && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={signedUrls[d.id]} download={d.file_name} rel="noopener noreferrer" aria-label={`Descargar ${d.file_name}`}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteFile(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/50" />

      {/* Informe de Alta */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Informe de Alta</h3>
          <Button
            size="sm"
            className="gap-2"
            disabled={!activeEpisodeId || !hasSessions}
            onClick={() => setShowDischargeReport(true)}
          >
            <FileText className="h-4 w-4" />
            Generar Informe de Alta
          </Button>
        </div>
        {(!activeEpisodeId || !hasSessions) && (
          <p className="text-muted-foreground text-sm text-center py-4">
            {!activeEpisodeId ? "No hay episodio activo." : "El episodio no tiene sesiones cargadas."}
          </p>
        )}
      </div>

      {/* Dialogs */}
      <UploadFileDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        patientId={patientId}
        userId={userId}
        onSaved={onRefresh}
        episodeId={activeEpisodeId}
      />
      <DeleteFileConfirm
        file={deleteFile}
        onClose={() => setDeleteFile(null)}
        onDeleted={(fileId) => { onFileDeleted(fileId); setDeleteFile(null); }}
      />
      <DischargeReportModal
        open={showDischargeReport}
        onOpenChange={(o) => { if (!o) dischargeReport.reset(); setShowDischargeReport(o); }}
        state={dischargeReport.state}
        reportText={dischargeReport.reportText}
        setReportText={dischargeReport.setReportText}
        onGenerate={dischargeReport.generate}
        onReset={dischargeReport.reset}
        patientName={patientName}
      />

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => { if (!open) setLightboxPhoto(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-gray-800 flex flex-col items-center justify-center gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto ampliada</DialogTitle>
            <DialogDescription>Vista ampliada de la imagen</DialogDescription>
          </DialogHeader>
          {lightboxPhoto && (
            <>
              <img src={lightboxPhoto.url} alt={lightboxPhoto.description || "Foto"} className="max-w-full max-h-[80vh] object-contain" />
              {(lightboxPhoto.date || lightboxPhoto.description) && (
                <div className="w-full px-4 py-2 text-center space-y-0.5">
                  {lightboxPhoto.date && <p className="text-xs text-gray-400">{format(new Date(lightboxPhoto.date), "dd/MM/yyyy")}</p>}
                  {lightboxPhoto.description && <p className="text-sm text-gray-200">{lightboxPhoto.description}</p>}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
