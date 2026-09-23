import { ClipboardList, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

const SETTINGS_ITEMS = [
  {
    title: "Evaluaciones",
    description: "Elegí qué escalas se muestran en el wizard de sesiones.",
    url: "/configuraciones/evaluaciones",
    icon: ClipboardList,
  },
];

export default function Settings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Configuraciones" subtitle="Personalizá cómo trabajás en HisTO." />

      <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
        {SETTINGS_ITEMS.map((item) => (
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
