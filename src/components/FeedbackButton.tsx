import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Botón flotante visible en toda la app autenticada (prep para la beta, ver
// DECISIONS.md 2026-10-06). Self-contenido a propósito (dialog + trigger juntos)
// para no tener que compartir estado con el banner de beta — ninguno de los dos
// necesita abrir el otro.
export function FeedbackButton() {
  const { session } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!session?.user?.id || !message.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: session.user.id,
      route: location.pathname,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo enviar. Probá de nuevo.");
      return;
    }
    toast.success("¡Gracias! Lo leemos a la brevedad.");
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 h-12 w-12 rounded-full shadow-lg"
          aria-label="Reportar problema o sugerencia"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar problema o sugerencia</DialogTitle>
          <DialogDescription>
            Estamos en beta — contanos qué encontraste. Lo lee el equipo de HisTO.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="¿Qué pasó, o qué te gustaría que mejoremos?"
          rows={5}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !message.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
