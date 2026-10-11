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

interface DraftFoundDialogProps {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export function DraftFoundDialog({ open, onKeep, onDiscard }: DraftFoundDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hay un borrador guardado</AlertDialogTitle>
          <AlertDialogDescription>
            Encontramos cambios sin guardar de un intento anterior en este mismo formulario.
            ¿Querés continuar donde lo dejaste o empezar de cero?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Empezar de cero</AlertDialogCancel>
          <AlertDialogAction onClick={onKeep}>Continuar borrador</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
