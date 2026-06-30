import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

interface Props {
  evaluations: any[];
  patientId: string;
}

export function FuncEvalList({ evaluations, patientId }: Props) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      {evaluations.map((e) => (
        <div
          key={e.id}
          className="bg-card rounded-[10px] border border-border px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/40 transition-colors"
          onClick={() => navigate(`/patients/${patientId}/evaluations/functional/${e.id}`)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-[13px]">{format(new Date(e.evaluation_date), "dd/MM/yyyy")}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {e.quickdash_score != null && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">QuickDASH: {e.quickdash_score}/100</span>
              )}
              {e.fim_score != null && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">FIM: {e.fim_score}/126</span>
              )}
              {e.barthel_score != null && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800">Barthel: {e.barthel_score}/100</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      ))}
    </div>
  );
}
