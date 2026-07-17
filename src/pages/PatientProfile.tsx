import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, ArrowLeft, Calendar, CheckCircle2, UserX, RotateCcw } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";

import { FichaTab } from "@/components/patients/tabs/FichaTab";
import { SessionsTab } from "@/components/patients/tabs/SessionsTab";
import { EvaluacionesTab } from "@/components/patients/tabs/EvaluacionesTab";
import { ArchivosTab } from "@/components/patients/tabs/ArchivosTab";
import { EvolucionTab } from "@/components/patients/EvolucionTab";
import { EjerciciosTab } from "@/components/patients/EjerciciosTab";

import { EditFichaDialog } from "@/components/patients/dialogs/EditFichaDialog";
import { NewFuncEvalDialog } from "@/components/patients/dialogs/NewFuncEvalDialog";
import { NewPatientApptDialog } from "@/components/patients/dialogs/NewPatientApptDialog";
import { NewEpisodeDialog } from "@/components/patients/dialogs/NewEpisodeDialog";
import { MarkAbandonDialog, ReactivateDialog } from "@/components/patients/dialogs/MarkAbandonDialog";
import { StatusBadge } from "@/components/status";
import { NewPlanDialog, PlanDetailDialog, EditPlanDialog, DeletePlanConfirm } from "@/components/patients/dialogs/PlanDialogs";

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [patient, setPatient] = useState<any>(null);
  const [clinical, setClinical] = useState<any>(null);
  const [occupational, setOccupational] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [funcEvals, setFuncEvals] = useState<any[]>([]);
  const [analEvals, setAnalEvals] = useState<any[]>([]);
  const [quickdashTokens, setQuickdashTokens] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinicalFiles, setClinicalFiles] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);

  // Dialog states
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [showNewFuncEval, setShowNewFuncEval] = useState(false);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState<any>(null);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [deletePlan, setDeletePlan] = useState<any>(null);
  const [showEditFicha, setShowEditFicha] = useState(false);

  const fetchSignedUrls = async (files: any[]) => {
    if (files.length === 0) { setSignedUrls({}); return; }
    setLoadingUrls(true);
    const urls: Record<string, string> = {};
    const results = await Promise.all(
      files.map(f => supabase.storage.from("clinical-files").createSignedUrl(f.file_path, 3600))
    );
    files.forEach((f, i) => {
      if (results[i].data?.signedUrl) urls[f.id] = results[i].data!.signedUrl;
    });
    setSignedUrls(urls);
    setLoadingUrls(false);
  };

  const fetchPatientBase = async () => {
    if (!id) return;
    const [p, o, ep] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("patient_occupational_profiles").select("*").eq("patient_id", id).maybeSingle(),
      supabase.from("treatment_episodes").select("*").eq("patient_id", id).eq("is_deleted", false).order("episode_number", { ascending: true }),
    ]);
    setPatient(p.data);
    setOccupational(o.data);
    const eps = ep.data || [];
    setEpisodes(eps);
    const activeEp = eps.find((e: any) => e.status === "active") || eps[eps.length - 1];
    const epId = activeEp?.id || null;
    if (!activeEpisodeId) setActiveEpisodeId(epId);
    return epId;
  };

  const fetchEpisodeData = async (episodeId: string | null) => {
    if (!id) return;
    const apptPromise = supabase.from("appointments").select("*").eq("patient_id", id).order("appointment_date", { ascending: false });

    if (!episodeId) {
      const [c, s, fe, ae, pl, cf, ap] = await Promise.all([
        supabase.from("patient_clinical_records").select("*").eq("patient_id", id).maybeSingle(),
        supabase.from("therapy_sessions").select("*").eq("patient_id", id).eq("is_deleted", false).order("session_date", { ascending: false }),
        supabase.from("functional_evaluations").select("*").eq("patient_id", id).order("evaluation_date", { ascending: false }),
        supabase.from("analytical_evaluations").select("*").eq("patient_id", id).order("evaluation_date", { ascending: false }),
        supabase.from("treatment_plans").select("*").eq("patient_id", id).eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("clinical_files").select("*").eq("patient_id", id).eq("is_deleted", false).order("photo_date", { ascending: false }),
        apptPromise,
      ]);
      setClinical(c.data); setSessions(s.data || []); setFuncEvals(fe.data || []);
      setAnalEvals(ae.data || []); setPlans(pl.data || []); setAppointments(ap.data || []);
      setQuickdashTokens([]);
      const files = cf.data || []; setClinicalFiles(files); setLoading(false); fetchSignedUrls(files);
      return;
    }

    const [c, s, fe, ae, pl, cf, ap, qt] = await Promise.all([
      supabase.from("patient_clinical_records").select("*").eq("patient_id", id).eq("episode_id", episodeId).maybeSingle(),
      supabase.from("therapy_sessions").select("*").eq("patient_id", id).eq("episode_id", episodeId).eq("is_deleted", false).order("session_date", { ascending: false }),
      supabase.from("functional_evaluations").select("*").eq("patient_id", id).eq("episode_id", episodeId).order("evaluation_date", { ascending: false }),
      supabase.from("analytical_evaluations").select("*").eq("patient_id", id).eq("episode_id", episodeId).order("evaluation_date", { ascending: false }),
      supabase.from("treatment_plans").select("*").eq("patient_id", id).eq("episode_id", episodeId).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("clinical_files").select("*").eq("patient_id", id).eq("is_deleted", false).order("photo_date", { ascending: false }),
      apptPromise,
      supabase.from("quickdash_tokens").select("completed_at, result").eq("episode_id", episodeId).not("result", "is", null).order("completed_at", { ascending: true }),
    ]);
    setClinical(c.data); setSessions(s.data || []); setFuncEvals(fe.data || []);
    setAnalEvals(ae.data || []); setPlans(pl.data || []); setAppointments(ap.data || []);
    setQuickdashTokens(qt.data || []);
    const files = cf.data || []; setClinicalFiles(files); setLoading(false); fetchSignedUrls(files);
  };

  const fetchAll = async () => {
    const epId = await fetchPatientBase();
    await fetchEpisodeData(activeEpisodeId || epId || null);
  };

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    if (activeEpisodeId && !loading) fetchEpisodeData(activeEpisodeId);
  }, [activeEpisodeId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!patient) return <p className="text-center text-muted-foreground py-12">Paciente no encontrado.</p>;

  const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;
  const initials = `${patient.last_name?.[0] || ""}${patient.first_name?.[0] || ""}`.toUpperCase();
  const activeEpisode = episodes.find((e: any) => e.id === activeEpisodeId);
  const sessionCount = sessions.length;
  const currentSessionLabel = sessionCount > 0 ? `Nº ${sessionCount}` : null;
  const now = new Date();
  const nextApptUpcoming = [...appointments]
    .filter(a => new Date(a.appointment_date) > now && a.status !== "cancelled")
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())[0];

  return (
    <div className="flex flex-col -m-4 md:-m-6 lg:-m-8 overflow-hidden h-[calc(100vh-56px)] lg:h-screen">
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="patient-sidebar w-[280px] shrink-0 overflow-y-auto border-r border-border p-7 hidden lg:block">
          <div className="space-y-7">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/patients")} className="hover:text-primary transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Pacientes
              </button>
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
              </div>
              <h1 className="leading-tight">
                <span className="font-serif text-[22px] font-semibold text-foreground block tracking-tight">{patient.last_name}</span>
                <span className="text-base text-foreground/60 font-normal">{patient.first_name}</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                {age !== null && <>{age} años</>}{age !== null && patient.dni ? " · " : ""}{patient.dni && <>DNI {patient.dni}</>}
              </p>
              {activeEpisode && patient.status === "active" && (
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-700">Episodio activo</span>
                </div>
              )}
              {patient.status !== "active" && (
                <div className="mt-3 space-y-1.5">
                  <StatusBadge status={patient.status} />
                  {patient.status === "abandoned" && patient.abandoned_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Abandonó el {format(new Date(patient.abandoned_at), "d MMM yyyy", { locale: es })}
                      {patient.abandon_reason ? ` — ${patient.abandon_reason}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {clinical?.diagnosis && (
                <div>
                  <p className="field-label mb-1">Diagnóstico</p>
                  <p className="text-[13px] text-foreground">{clinical.diagnosis}</p>
                </div>
              )}
              <div>
                <p className="field-label mb-1">Admisión</p>
                <p className="text-[13px] text-foreground">{format(new Date(patient.admission_date), "d MMM yyyy", { locale: es })}</p>
              </div>
              {currentSessionLabel && (
                <div>
                  <p className="field-label mb-1">Sesión actual</p>
                  <p className="text-[13px] text-foreground">{currentSessionLabel}</p>
                </div>
              )}
              {patient.phone && (
                <div>
                  <p className="field-label mb-1">Teléfono</p>
                  <p className="text-[13px] text-foreground">{patient.phone}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => {
                  const isFirst = sessions.length === 0;
                  const params = new URLSearchParams();
                  if (activeEpisodeId) params.set("episode", activeEpisodeId);
                  if (isFirst) params.set("type", "admission");
                  navigate(`/patients/${id}/sessions/new${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                size="sm" className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> {sessions.length === 0 ? "Registrar admisión" : "Nueva sesión"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowNewAppt(true)}>
                <Calendar className="h-4 w-4 mr-2" /> Nuevo turno
              </Button>
              {patient?.status === "active" && sessions.length > 0 && (
                <Button
                  variant="outline" size="sm" className="w-full"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (activeEpisodeId) params.set("episode", activeEpisodeId);
                    params.set("type", "discharge");
                    navigate(`/patients/${id}/sessions/new?${params.toString()}`);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Dar de alta
                </Button>
              )}
              {patient?.status === "active" && (
                <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => setShowAbandon(true)}>
                  <UserX className="h-4 w-4 mr-2" /> Marcar abandono
                </Button>
              )}
              {patient?.status === "abandoned" && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowReactivate(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reactivar paciente
                </Button>
              )}
            </div>

            {episodes.length > 1 && (
              <div className="space-y-2">
                <p className="field-label">Episodios</p>
                {episodes.map((ep: any) => (
                  <button
                    key={ep.id}
                    onClick={() => setActiveEpisodeId(ep.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${ep.id === activeEpisodeId ? "bg-primary/10 text-primary border-primary/20 font-medium" : "bg-card text-foreground border-border hover:bg-muted"}`}
                  >
                    Ep. {ep.episode_number}{ep.diagnosis ? ` — ${ep.diagnosis}` : ""}
                  </button>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowNewEpisode(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Nuevo episodio
                </Button>
              </div>
            )}
            {episodes.length <= 1 && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowNewEpisode(true)}>
                <Plus className="h-3 w-3 mr-1" /> Nuevo episodio
              </Button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="patient-content flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header bar */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-7 py-3 flex items-center gap-4 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-serif text-base font-semibold text-foreground">{patient.last_name}, {patient.first_name}</h2>
                {age !== null && <span className="text-sm text-muted-foreground">{age} años</span>}
                {activeEpisode && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Ep. activo
                  </span>
                )}
              </div>
              {clinical?.diagnosis && <p className="text-xs text-muted-foreground mt-0.5 truncate">{clinical.diagnosis}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-foreground font-medium tabular-nums">
                {sessionCount} sesión{sessionCount !== 1 ? "es" : ""}
              </span>
              {nextApptUpcoming && (
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-foreground font-medium">
                  Próx. {format(new Date(nextApptUpcoming.appointment_date), "d MMM", { locale: es })}
                </span>
              )}
              {patient.clinical_record_number && (
                <span className="text-xs text-muted-foreground font-mono">HC #{patient.clinical_record_number}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-7">
            <Tabs defaultValue="clinica" className="space-y-4">
              <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
                {[
                  { value: "clinica", label: "Ficha Clínica" },
                  { value: "sessions", label: "Sesiones" },
                  { value: "evolucion", label: "Evolución" },
                  { value: "evaluaciones", label: "Evaluaciones" },
                  { value: "ejercicios", label: "Ejercicios" },
                  { value: "archivos", label: "Archivos" },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="clinica">
                <FichaTab patient={patient} clinical={clinical} occupational={occupational} activeEpisode={activeEpisode ?? null} onEditFicha={() => setShowEditFicha(true)} />
              </TabsContent>

              <TabsContent value="sessions">
                <SessionsTab sessions={sessions} analEvals={analEvals} funcEvals={funcEvals} patientId={id!} activeEpisodeId={activeEpisodeId} isDischargedPatient={patient?.status === "discharged" || patient?.status === "abandoned"} onDeleted={fetchAll} />
              </TabsContent>

              <TabsContent value="evolucion">
                <EvolucionTab analEvals={analEvals} funcEvals={funcEvals} sessions={sessions} episode={activeEpisode ?? null} patientId={id!} quickdashTokens={quickdashTokens} />
              </TabsContent>

              <TabsContent value="evaluaciones">
                <EvaluacionesTab funcEvals={funcEvals} analEvals={analEvals} patientId={id!} activeEpisodeId={activeEpisodeId} onNewFuncEval={() => setShowNewFuncEval(true)} />
              </TabsContent>

              <TabsContent value="ejercicios">
                <EjerciciosTab patientId={id!} />
              </TabsContent>

              <TabsContent value="archivos">
                <ArchivosTab
                  clinicalFiles={clinicalFiles}
                  signedUrls={signedUrls}
                  loadingUrls={loadingUrls}
                  patientId={id!}
                  userId={user!.id}
                  activeEpisodeId={activeEpisodeId}
                  hasSessions={sessions.length > 0}
                  patientName={`${patient.first_name} ${patient.last_name}`}
                  session={session}
                  onRefresh={fetchAll}
                  onFileDeleted={(fileId) => {
                    setClinicalFiles(prev => prev.filter(f => f.id !== fileId));
                    setSignedUrls(prev => { const n = { ...prev }; delete n[fileId]; return n; });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NewEpisodeDialog open={showNewEpisode} onClose={() => setShowNewEpisode(false)} patientId={id!} userId={user!.id} episodes={episodes} onSaved={async (newEpId: string) => { setActiveEpisodeId(newEpId); await fetchPatientBase(); await fetchEpisodeData(newEpId); }} />
      <EditFichaDialog open={showEditFicha} onClose={() => setShowEditFicha(false)} patient={patient} clinical={clinical} occupational={occupational} activeEpisodeId={activeEpisodeId} onSaved={fetchAll} />
      <MarkAbandonDialog open={showAbandon} onClose={() => setShowAbandon(false)} patientId={id!} activeEpisodeId={activeEpisodeId} onSaved={fetchAll} />
      <ReactivateDialog open={showReactivate} onClose={() => setShowReactivate(false)} patientId={id!} onSaved={fetchAll} />
      <NewFuncEvalDialog open={showNewFuncEval} onClose={() => setShowNewFuncEval(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <NewPatientApptDialog open={showNewAppt} onClose={() => setShowNewAppt(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <NewPlanDialog open={showNewPlan} onClose={() => setShowNewPlan(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <PlanDetailDialog plan={showPlanDetail} onClose={() => setShowPlanDetail(null)} />
      <EditPlanDialog plan={editPlan} onClose={() => setEditPlan(null)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <DeletePlanConfirm plan={deletePlan} onClose={() => setDeletePlan(null)} onSaved={fetchAll} />
    </div>
  );
}
