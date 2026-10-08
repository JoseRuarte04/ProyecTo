import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChangeEmailCard from "@/components/profile/ChangeEmailCard";

export default function AccountEmailSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        onClick={() => navigate("/configuraciones")}
        className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Configuraciones
      </button>

      <PageHeader title="Cambio de email" subtitle="El email con el que iniciás sesión." />

      <ChangeEmailCard email={profile.email} />
    </div>
  );
}
