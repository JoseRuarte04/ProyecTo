import { Skeleton } from "@/components/ui/skeleton";

// Filas de lista sin contenedor — para usar dentro de un panel ya bordeado.
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-[45%] max-w-[220px]" />
            <Skeleton className="h-3 w-[30%] max-w-[140px]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

// Lista completa con encabezado de columnas, con el estilo dashboard-card.
export function ListSkeleton({ rows = 6, withHeader = true }: { rows?: number; withHeader?: boolean }) {
  return (
    <div className="dashboard-card overflow-hidden">
      {withHeader && (
        <div className="px-5 py-2.5 border-b border-border bg-muted">
          <Skeleton className="h-3 w-32" />
        </div>
      )}
      <RowsSkeleton rows={rows} />
    </div>
  );
}

// Silueta del Dashboard: saludo + acciones + agenda con panel lateral.
export function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      {/* Saludo */}
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Agenda */}
        <div className="dashboard-card p-7 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="w-[3px] h-10 rounded-full" />
                <div className="w-14 space-y-1.5">
                  <Skeleton className="h-4 w-11" />
                  <Skeleton className="h-2.5 w-9" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-[40%] max-w-[200px]" />
                  <Skeleton className="h-3 w-[25%] max-w-[120px]" />
                </div>
                <Skeleton className="h-2 w-2 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dashboard-card p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-3.5 w-[85%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
