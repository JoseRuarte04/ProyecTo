import { useState } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, RefreshCw, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReportState } from "@/hooks/useDischargeReport";

interface DischargeReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ReportState;
  reportText: string;
  setReportText: (text: string) => void;
  onGenerate: () => void;
  onReset: () => void;
  patientName: string;
}

export function DischargeReportModal({
  open,
  onOpenChange,
  state,
  reportText,
  setReportText,
  onGenerate,
  onReset,
  patientName,
}: DischargeReportModalProps) {
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    const addPage = () => {
      doc.addPage();
      y = margin;
    };

    const checkSpace = (needed: number) => {
      if (y + needed > pageH - margin) addPage();
    };

    // Split a line into tokens handling **text** and *text* as bold; strips stray asterisks
    const tokenize = (line: string) => {
      const tokens: { text: string; bold: boolean; isSpace: boolean }[] = [];
      const addPart = (text: string, bold: boolean) => {
        text.split(/(\s+)/).forEach((piece) => {
          if (piece !== "") tokens.push({ text: piece, bold, isSpace: piece.trim() === "" });
        });
      };
      const pattern = /\*\*(.*?)\*\*|\*([^*\n]+?)\*/g;
      let lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (match.index > lastIndex) addPart(line.slice(lastIndex, match.index).replace(/\*/g, ""), false);
        addPart(match[1] ?? match[2], true);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < line.length) addPart(line.slice(lastIndex).replace(/\*/g, ""), false);
      return tokens;
    };

    // Render a body line with inline **bold** support and automatic word wrapping
    const renderInlineLine = (rawLine: string) => {
      const lineH = 5;

      if (!/\*/.test(rawLine)) {
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(rawLine, contentW);
        checkSpace(wrapped.length * lineH);
        doc.text(wrapped, margin, y);
        y += wrapped.length * lineH + 1;
        return;
      }

      checkSpace(lineH + 1);
      let x = margin;
      let lineStart = true;

      for (const token of tokenize(rawLine)) {
        if (lineStart && token.isSpace) continue;

        doc.setFont("helvetica", token.bold ? "bold" : "normal");
        const tw = doc.getTextWidth(token.text);

        // Wrap before a word that would overflow (never wrap on spaces)
        if (!token.isSpace && !lineStart && x + tw > margin + contentW) {
          x = margin;
          y += lineH;
          if (y + lineH > pageH - margin) addPage();
        }

        doc.text(token.text, x, y);
        x += tw;
        if (!token.isSpace) lineStart = false;
      }

      doc.setFont("helvetica", "normal");
      y += lineH + 1;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INFORME DE ALTA — TERAPIA OCUPACIONAL", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Paciente: ${patientName}`, margin, y);
    y += 5;
    doc.text(`Fecha de emisión: ${format(new Date(), "dd/MM/yyyy", { locale: es })}`, margin, y);
    y += 5;
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Body
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    for (const rawLine of reportText.split("\n")) {
      if (rawLine.startsWith("## ")) {
        checkSpace(12);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        const wrapped = doc.splitTextToSize(rawLine.replace(/^## /, "").replace(/\*/g, ""), contentW);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 6 + 3;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
      } else if (rawLine.startsWith("### ")) {
        checkSpace(10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        const wrapped = doc.splitTextToSize(rawLine.replace(/^### /, "").replace(/\*/g, ""), contentW);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 2;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
      } else if (rawLine.trim() === "") {
        y += 4;
      } else {
        renderInlineLine(rawLine);
      }
    }

    const slug = patientName.toLowerCase().replace(/\s+/g, "-");
    const dateStr = format(new Date(), "yyyy-MM-dd");
    doc.save(`informe-alta-${slug}-${dateStr}.pdf`);
  };

  const handleClose = () => {
    onReset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Informe de Alta — {patientName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
            {state === "generating" && reportText === "" && (
              <div className="space-y-2 py-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {(state === "generating" && reportText !== "") || state === "ready" || state === "exporting" ? (
              <div className="flex-1 overflow-auto min-h-0">
                <Textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  readOnly={state === "generating"}
                  className={cn(
                    "min-h-[450px] font-mono text-sm resize-none leading-relaxed",
                    state === "generating" && "opacity-80"
                  )}
                  placeholder="Generando informe..."
                />
              </div>
            ) : null}

            {state === "idle" && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
                <FileText className="h-12 w-12 opacity-30" />
                <p className="text-sm">Hacé click en "Generar" para crear el informe de alta.</p>
              </div>
            )}
          </div>

          {state === "ready" && (
            <p className="text-xs text-muted-foreground text-center">
              Revisá el informe antes de exportar. Podés editarlo directamente en el texto.
            </p>
          )}

          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
            {state === "idle" && (
              <Button onClick={onGenerate} className="gap-2">
                <Loader2 className="h-4 w-4" />
                Generar
              </Button>
            )}

            {state === "generating" && (
              <Button disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </Button>
            )}

            {state === "ready" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRegenerateAlert(true)}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerar
                </Button>
                <Button onClick={handleExportPdf} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>
              </>
            )}

            <Button variant="ghost" onClick={handleClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRegenerateAlert} onOpenChange={setShowRegenerateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el informe?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descartará el informe actual y se generará uno nuevo. Los cambios que hayas hecho se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenerateAlert(false);
                onReset();
                onGenerate();
              }}
            >
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
