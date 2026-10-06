import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { acceptPrivacyPolicy } from "@/lib/privacyPolicy";
import { toast } from "sonner";

// Gate bloqueante para usuarios ya logueados sin consentimiento vigente registrado
// (usuarios existentes de antes de esta feature, un insert que falló durante el
// registro, o una versión de la política más nueva que la que aceptaron). Sin botón
// de cancelar ni cierre por click afuera/Escape a propósito — AlertDialog de shadcn
// no los agrega salvo que uno los ponga.
export function PrivacyConsentGate({ userId, onAccepted }: { userId: string; onAccepted: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    setSubmitting(true);
    const { error } = await acceptPrivacyPolicy(userId);
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo registrar la aceptación. Probá de nuevo.");
      return;
    }
    onAccepted();
  };

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Actualizamos la política de privacidad</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-foreground">
              <p>
                Antes de seguir, necesitamos que leas y aceptes nuestra{" "}
                <Link to="/privacidad" target="_blank" className="underline underline-offset-2">
                  política de privacidad
                </Link>
                .
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAccept} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acepto"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
