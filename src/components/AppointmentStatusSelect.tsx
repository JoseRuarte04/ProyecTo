import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_OPTIONS, appointmentStatusStyle } from "@/components/status";
import { cn } from "@/lib/utils";

// Badge clickeable que abre la lista de estados con su color.
export function AppointmentStatusSelect({
  status, onChange, disabled,
}: {
  status: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const current = appointmentStatusStyle(status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        onClick={e => e.stopPropagation()}
        aria-label={`Estado del turno: ${current.label}. Cambiar`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          current.badge
        )}
      >
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {APPOINTMENT_STATUS_OPTIONS.map(key => (
          <DropdownMenuItem key={key} onSelect={() => key !== status && onChange(key)} className="gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", APPOINTMENT_STATUS[key].dot)} />
            <span className="flex-1">{APPOINTMENT_STATUS[key].label}</span>
            {key === status && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
