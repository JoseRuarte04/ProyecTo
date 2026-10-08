import { User, Mail, KeyRound, ClipboardList, CalendarClock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const ACCOUNT_ITEMS = [
  {
    title: "Configuración general",
    description: "Nombre, especialidad, matrícula y foto de perfil.",
    url: "/configuraciones/general",
    icon: User,
  },
  {
    title: "Cambio de email",
    description: "Actualizá el email con el que iniciás sesión.",
    url: "/configuraciones/email",
    icon: Mail,
  },
  {
    title: "Cambio de contraseña",
    description: "Actualizá la contraseña de tu cuenta.",
    url: "/configuraciones/password",
    icon: KeyRound,
  },
];

const TEAM_ITEMS = [
  {
    title: "Evaluaciones",
    description: "Elegí qué escalas se muestran en el wizard de sesiones.",
    url: "/configuraciones/evaluaciones",
    icon: ClipboardList,
  },
  {
    title: "Turnos",
    description: "Elegí cuántas ausencias de un paciente disparan una advertencia.",
    url: "/configuraciones/turnos",
    icon: CalendarClock,
  },
];

function SettingsGroup({ label, items }: { label: string; items: typeof ACCOUNT_ITEMS }) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { workspace } = useWorkspace();
  // "Equipo" agrupa config compartida (hoy editable solo por el admin del
  // equipo) — mismo gate que antes decidía si "Configuraciones" aparecía
  // en el sidebar. "Mi cuenta" es siempre del usuario, nunca se filtra.
  const canSeeTeamSettings = workspace.type === "team" ? workspace.isAdmin : true;

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="Configuraciones" subtitle="Personalizá cómo trabajás en HisTO." />

      <SettingsGroup label="Mi cuenta" items={ACCOUNT_ITEMS} />

      {canSeeTeamSettings && <SettingsGroup label="Equipo" items={TEAM_ITEMS} />}
    </div>
  );
}
