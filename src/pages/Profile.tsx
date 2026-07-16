import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Loader2 } from "lucide-react";
import PersonalDataCard from "@/components/profile/PersonalDataCard";

export default function Profile() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfil"
        subtitle="Gestioná tus datos personales y de acceso"
      />
      <div className="max-w-2xl space-y-6">
        <PersonalDataCard profile={profile} />
      </div>
    </div>
  );
}
