import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Eye, Edit, Search, Trash2, FileDown, Upload, Download, Image as ImageIcon, ChevronDown, ChevronUp, ChevronRight, BarChart3, Activity, Calendar, ClipboardList, Stethoscope, User, Heart, BriefcaseMedical, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription } from "@/components/ui/dialog";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { exportPlanPdf } from "@/components/plans/PlanPdfExport";
import { AnalEvalList } from "@/components/evaluations/AnalyticalEvalForm";
import { EDEMA_POINTS, isNewEdemaFormat, normalizeEdemaValue, isCircometriaFormat, normalizeCircometriaValue } from "@/components/clinical/EdemaCircometryTable";
import { QUICKDASH_QUESTIONS, FIM_MOTOR, FIM_COGNITIVE } from "@/components/evaluations/FunctionalScales";
import { DischargeReportModal } from "@/components/patients/DischargeReportModal";
import { useDischargeReport } from "@/hooks/useDischargeReport";

const ALLOWED_CLINICAL_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
] as const;

const CLINICAL_FILE_ACCEPT = ALLOWED_CLINICAL_FILE_TYPES.join(",");

const isAllowedClinicalFileType = (type: string) =>
  ALLOWED_CLINICAL_FILE_TYPES.includes(type as (typeof ALLOWED_CLINICAL_FILE_TYPES)[number]);

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
  const [plans, setPlans] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinicalFiles, setClinicalFiles] = useState<any[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [showNewEpisode, setShowNewEpisode] = useState(false);

  // Dialog states
  
  const [showNewFuncEval, setShowNewFuncEval] = useState(false);
  
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState<any>(null);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [deletePlan, setDeletePlan] = useState<any>(null);
  const [showEditFicha, setShowEditFicha] = useState(false);
  
  const [evalSubTab, setEvalSubTab] = useState("functional");
  const [showUploadFile, setShowUploadFile] = useState(false);
  const [deleteFile, setDeleteFile] = useState<any>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; description?: string; date?: string } | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [showDischargeReport, setShowDischargeReport] = useState(false);
  const dischargeReport = useDischargeReport(id ?? "", activeEpisodeId, session);

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
    // Default to active episode or last one
    const activeEp = eps.find((e: any) => e.status === "active") || eps[eps.length - 1];
    const epId = activeEp?.id || null;
    if (!activeEpisodeId) setActiveEpisodeId(epId);
    return epId;
  };

  const fetchEpisodeData = async (episodeId: string | null) => {
    if (!id) return;
    const apptPromise = supabase.from("appointments").select("*").eq("patient_id", id).order("appointment_date", { ascending: false });
    
    if (!episodeId) {
      // No episode: fallback to patient-level queries
      const [c, s, fe, ae, pl, cf, ap] = await Promise.all([
        supabase.from("patient_clinical_records").select("*").eq("patient_id", id).maybeSingle(),
        supabase.from("therapy_sessions").select("*").eq("patient_id", id).eq("is_deleted", false).order("session_date", { ascending: false }),
        supabase.from("functional_evaluations").select("*").eq("patient_id", id).order("evaluation_date", { ascending: false }),
        supabase.from("analytical_evaluations").select("*").eq("patient_id", id).order("evaluation_date", { ascending: false }),
        supabase.from("treatment_plans").select("*").eq("patient_id", id).eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("clinical_files").select("*").eq("patient_id", id).eq("is_deleted", false).order("photo_date", { ascending: false }),
        apptPromise,
      ]);
      setClinical(c.data);
      setSessions(s.data || []);
      setFuncEvals(fe.data || []);
      setAnalEvals(ae.data || []);
      setPlans(pl.data || []);
      setAppointments(ap.data || []);
      const files = cf.data || [];
      setClinicalFiles(files);
      setLoading(false);
      fetchSignedUrls(files);
      return;
    }

    const [c, s, fe, ae, pl, cf, ap] = await Promise.all([
      supabase.from("patient_clinical_records").select("*").eq("patient_id", id).eq("episode_id", episodeId).maybeSingle(),
      supabase.from("therapy_sessions").select("*").eq("patient_id", id).eq("episode_id", episodeId).eq("is_deleted", false).order("session_date", { ascending: false }),
      supabase.from("functional_evaluations").select("*").eq("patient_id", id).eq("episode_id", episodeId).order("evaluation_date", { ascending: false }),
      supabase.from("analytical_evaluations").select("*").eq("patient_id", id).eq("episode_id", episodeId).order("evaluation_date", { ascending: false }),
      supabase.from("treatment_plans").select("*").eq("patient_id", id).eq("episode_id", episodeId).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("clinical_files").select("*").eq("patient_id", id).eq("is_deleted", false).order("photo_date", { ascending: false }),
      apptPromise,
    ]);
    setClinical(c.data);
    setSessions(s.data || []);
    setFuncEvals(fe.data || []);
    setAnalEvals(ae.data || []);
    setPlans(pl.data || []);
    setAppointments(ap.data || []);
    const files = cf.data || [];
    setClinicalFiles(files);
    setLoading(false);
    fetchSignedUrls(files);
  };

  const fetchAll = async () => {
    const epId = await fetchPatientBase();
    await fetchEpisodeData(activeEpisodeId || epId || null);
  };

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

  useEffect(() => { fetchAll(); }, [id]);

  // Re-fetch episode-scoped data when switching episodes
  useEffect(() => {
    if (activeEpisodeId && !loading) {
      fetchEpisodeData(activeEpisodeId);
    }
  }, [activeEpisodeId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!patient) return <p className="text-center text-muted-foreground py-12">Paciente no encontrado.</p>;

  const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;

  const appointmentTypeMap: Record<string, string> = { consultation: "Consulta", follow_up: "Seguimiento", evaluation: "Evaluación" };

  const planStatusMap: Record<string, string> = { active: "Activo", completed: "Completado", archived: "Archivado" };

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
      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — patient sidebar */}
        <div className="patient-sidebar w-[280px] shrink-0 overflow-y-auto border-r border-border p-7 hidden lg:block">
          <div className="space-y-7">
            {/* Breadcrumb */}
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
            {activeEpisode && (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-700">Episodio activo</span>
              </div>
            )}
          </div>

          {/* Patient details */}
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

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              onClick={() => {
                const isFirst = sessions.length === 0;
                const params = new URLSearchParams();
                if (activeEpisodeId) params.set("episode", activeEpisodeId);
                if (isFirst) params.set("type", "admission");
                navigate(`/patients/${id}/sessions/new${params.toString() ? `?${params.toString()}` : ''}`);
              }}
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" /> {sessions.length === 0 ? "Registrar admisión" : "Nueva sesión"}
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowNewAppt(true)}>
              <Calendar className="h-4 w-4 mr-2" /> Nuevo turno
            </Button>
          </div>

          {/* Episode selector */}
          {episodes.length > 1 && (
            <div className="space-y-2">
              <p className="field-label">Episodios</p>
              {episodes.map((ep: any) => (
                <button
                  key={ep.id}
                  onClick={() => setActiveEpisodeId(ep.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                    ep.id === activeEpisodeId
                      ? "bg-primary/10 text-primary border-primary/20 font-medium"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
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

        {/* Center panel — main content */}
        <div className="patient-content flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Patient header bar — always visible */}
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
            <button
              onClick={() => setContextOpen(v => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors hidden xl:block"
              title={contextOpen ? "Ocultar panel de contexto" : "Mostrar panel de contexto"}
            >
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${contextOpen ? "" : "rotate-180"}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-7">
          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
              <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">Sesiones</TabsTrigger>
              <TabsTrigger value="clinica" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">Clínica</TabsTrigger>
              <TabsTrigger value="evaluaciones" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">Evaluaciones</TabsTrigger>
              <TabsTrigger value="archivos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">Archivos</TabsTrigger>
              <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground px-4 py-3 text-[13px] font-medium tracking-wide">Administración</TabsTrigger>
            </TabsList>

        {/* FICHA */}
        <TabsContent value="clinica" className="space-y-5">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowEditFicha(true)}>
              <Edit className="h-4 w-4 mr-1" /> Editar ficha
            </Button>
          </div>
          {(() => {
            const treatmentLabel = clinical?.treatment_type
              ? ({ conservative: "Conservador", surgery: "Quirúrgico", mixed: "Mixto" } as Record<string, string>)[clinical.treatment_type] || clinical.treatment_type
              : null;
            const dominanceLabel = occupational?.dominance
              ? ({ right: "Diestro/a", left: "Zurdo/a", ambidextrous: "Ambidiestro/a" } as Record<string, string>)[occupational.dominance] || occupational.dominance
              : null;
            const fmtDate = (d: string | null | undefined) =>
              d ? format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: es }) : null;
            const periodStr = (w: number | null | undefined, d: number | null | undefined) => {
              if (w == null && d == null) return null;
              return [w != null ? `${w} sem` : "", d != null ? `${d} días` : ""].filter(Boolean).join(" · ");
            };
            const periodFromDate = (dateStr: string | null | undefined) => {
              if (!dateStr) return null;
              const diff = Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 86400000);
              if (diff < 0) return null;
              return `${Math.floor(diff / 7)} sem · ${diff % 7} días`;
            };

            const Field = ({ label, value, full, showEmpty = false }: { label: string; value: any; full?: boolean; showEmpty?: boolean }) => {
              const isEmpty = value == null || value === "";
              if (isEmpty && !showEmpty) return null;
              return (
                <div className={full ? "col-span-2" : ""}>
                  <p className="field-label mb-0.5">{label}</p>
                  <p className={`text-sm whitespace-pre-wrap ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>{isEmpty ? "Sin registrar" : value}</p>
                </div>
              );
            };

            const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
              <div className="bg-card rounded-[10px] border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 bg-muted">
                  <span className="text-muted-foreground">{icon}</span>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
                  {children}
                </div>
              </div>
            );

            return (
              <div className="space-y-5">
                {/* Episodio activo */}
                <Section title="Episodio activo" icon={<ClipboardList className="h-4 w-4" />}>
                  {clinical?.diagnosis && (
                    <Field label="Diagnóstico principal" value={clinical.diagnosis} full />
                  )}
                  <Field label="Tipo de tratamiento" value={treatmentLabel} />
                  <Field label="Médico derivante" value={clinical?.doctor_name} />
                  <Field label="Fecha de admisión" value={patient.admission_date ? format(new Date(patient.admission_date), "d MMM yyyy", { locale: es }) : null} />
                  <Field label="Nº de episodio" value={activeEpisode?.episode_number} />
                  <Field label="Nº de afiliado" value={patient.insurance_number} />
                  <Field label="Nacionalidad" value={(patient as any).nationality} />
                  {(patient as any).gender && (
                    <Field label="Género" value={{ female: "Femenino", male: "Masculino", other: "Otro", no_data: "Prefiero no decir" }[(patient as any).gender] ?? (patient as any).gender} />
                  )}
                  <Field label="Teléfono" value={patient.phone} />
                  {(patient as any).email && <Field label="Email" value={(patient as any).email} />}
                  <Field label="Domicilio" value={(patient as any).address} full />
                  {(patient as any).emergency_contact_name && (
                    <Field
                      label="Contacto de emergencia"
                      value={`${(patient as any).emergency_contact_name}${(patient as any).emergency_contact_phone ? " · " + (patient as any).emergency_contact_phone : ""}${(patient as any).emergency_contact_relation ? " (" + (patient as any).emergency_contact_relation + ")" : ""}`}
                      full
                    />
                  )}
                </Section>

                {/* Datos clínicos */}
                {clinical && (clinical.injury_date || clinical.surgery_date || clinical.symptom_start_date || clinical.injury_mechanism || clinical.treatment_type || clinical.immobilization_type || clinical.studies || clinical.weeks_post_injury || clinical.weeks_post_surgery || clinical.immobilization_weeks || clinical.diagnosis) && (
                  <Section title="Datos clínicos" icon={<Stethoscope className="h-4 w-4" />}>
                    <Field label="Fecha de lesión" value={fmtDate(clinical.injury_date)} />
                    <Field label="Fecha de cirugía" value={fmtDate(clinical.surgery_date)} showEmpty />
                    <Field label="Mecanismo de lesión" value={clinical.injury_mechanism} full />
                    <Field label="Tipo de tratamiento" value={treatmentLabel} />
                    <Field label="Semanas post-lesión" value={periodStr(clinical.weeks_post_injury, clinical.days_post_injury) ?? periodFromDate(clinical.injury_date)} />
                    <Field label="Semanas post-operatorio" value={periodStr(clinical.weeks_post_surgery, clinical.days_post_surgery) ?? periodFromDate(clinical.surgery_date)} />
                    <Field label="Semanas de inmovilización" value={periodStr(clinical.immobilization_weeks, clinical.immobilization_days)} />
                    <Field label="Tipo de inmovilización" value={clinical.immobilization_type} />
                    <Field label="Estudios" value={clinical.studies} full />
                    <Field label="Inicio síntomas" value={fmtDate(clinical.symptom_start_date)} />
                    <Field label="Próximo OyT" value={fmtDate(clinical.next_oyt_appointment)} />
                    <Field label="Tratamiento actual" value={clinical.current_treatment} full />
                    <Field label="Tratamiento farmacológico" value={clinical.pharmacological_treatment} full />
                    <Field label="Antecedentes personales" value={clinical.medical_history} full />
                    <Field label="Notas" value={clinical.notes} full />
                  </Section>
                )}

                {/* Perfil ocupacional */}
                {occupational && (
                  <Section title="Perfil ocupacional" icon={<User className="h-4 w-4" />}>
                    <Field label="Lateralidad" value={dominanceLabel} />
                    <Field label="Trabajo" value={occupational.job} />
                    <Field label="Educación" value={occupational.education} />
                    <Field label="Red de apoyo" value={occupational.support_network} />
                    <Field label="Ocio" value={occupational.leisure} />
                    <Field label="Actividad física" value={occupational.physical_activity} />
                    <Field label="Sueño y descanso" value={occupational.sleep_rest} />
                    {occupational.dash_score != null && (
                      <Field label="Puntaje DASH" value={`${occupational.dash_score} / 100`} />
                    )}
                    <Field label="Notas" value={occupational.notes} full />
                  </Section>
                )}

                {!clinical && !occupational && (
                  <div className="bg-card rounded-[10px] border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                    Sin datos clínicos ni perfil ocupacional registrado.
                  </div>
                )}
              </div>
            );
          })()}

        </TabsContent>

        {/* EVALUACIONES */}
        <TabsContent value="evaluaciones" className="space-y-4">
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex">
              {[{ value: "functional", label: "Funcional" }, { value: "analytical", label: "Analítica" }].map(t => (
                <button
                  key={t.value}
                  onClick={() => setEvalSubTab(t.value)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    evalSubTab === t.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {evalSubTab === "functional" && (
              <Button onClick={() => setShowNewFuncEval(true)} size="sm" className="mb-1"><Plus className="h-4 w-4 mr-1" />Nueva evaluación</Button>
            )}
          </div>
          {evalSubTab === "functional" && (
            funcEvals.length === 0
              ? <p className="text-muted-foreground text-sm text-center py-8">Sin evaluaciones funcionales.</p>
              : <FuncEvalList evaluations={funcEvals} patientId={id!} />
          )}
          {evalSubTab === "analytical" && (
            <>
              <AnalEvalList evaluations={analEvals} patientId={id!} />
              {analEvals.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Las evaluaciones analíticas se registran desde Sesiones.</p>
              )}
            </>
          )}
        </TabsContent>

        {/* OCUPACIONAL — removed, content lives in Clínica tab */}
        {false && <TabsContent value="ocupacional" className="space-y-5">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowEditFicha(true)}>
              <Edit className="h-4 w-4 mr-1" /> Editar
            </Button>
          </div>
          {occupational ? (
            <div className="bg-card rounded-[10px] border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Perfil ocupacional</h3>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
                {occupational.dominance && <div><p className="field-label mb-0.5">Lateralidad</p><p className="text-sm text-foreground">{({right: "Diestro/a", left: "Zurdo/a", ambidextrous: "Ambidiestro/a"} as any)[occupational.dominance] || occupational.dominance}</p></div>}
                {occupational.job && <div><p className="field-label mb-0.5">Trabajo</p><p className="text-sm text-foreground">{occupational.job}</p></div>}
                {occupational.education && <div><p className="field-label mb-0.5">Educación</p><p className="text-sm text-foreground">{occupational.education}</p></div>}
                {occupational.support_network && <div><p className="field-label mb-0.5">Red de apoyo</p><p className="text-sm text-foreground">{occupational.support_network}</p></div>}
                {occupational.leisure && <div className="col-span-2"><p className="field-label mb-0.5">Ocio</p><p className="text-sm text-foreground">{occupational.leisure}</p></div>}
                {occupational.physical_activity && <div className="col-span-2"><p className="field-label mb-0.5">Actividad física</p><p className="text-sm text-foreground">{occupational.physical_activity}</p></div>}
                {occupational.sleep_rest && <div className="col-span-2"><p className="field-label mb-0.5">Sueño y descanso</p><p className="text-sm text-foreground">{occupational.sleep_rest}</p></div>}
                {occupational.dash_score != null && <div><p className="field-label mb-0.5">Puntaje DASH</p><p className="text-sm text-foreground">{occupational.dash_score} / 100</p></div>}
                {occupational.notes && <div className="col-span-2"><p className="field-label mb-0.5">Notas</p><p className="text-sm text-foreground">{occupational.notes}</p></div>}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-[10px] border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              Sin perfil ocupacional registrado. <button className="text-primary hover:underline" onClick={() => setShowEditFicha(true)}>Completar ficha</button>
            </div>
          )}
        </TabsContent>}

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-foreground">Historial de visitas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} {sessions.length === 1 ? "visita registrada" : "visitas registradas"}</p>
            </div>
            <Button
              onClick={() => {
                const isFirst = sessions.length === 0;
                const params = new URLSearchParams();
                if (activeEpisodeId) params.set("episode", activeEpisodeId);
                if (isFirst) params.set("type", "admission");
                navigate(`/patients/${id}/sessions/new${params.toString() ? `?${params.toString()}` : ''}`);
              }}
              size="sm"
              disabled={patient?.status === "discharged"}
              title={patient?.status === "discharged" ? "El paciente está de alta — no se pueden agregar más sesiones" : undefined}
            ><Plus className="h-4 w-4 mr-2" />{sessions.length === 0 ? "Registrar admisión" : "Nueva sesión"}</Button>
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Activity className="h-8 w-8 text-primary/50" />
              </div>
              <p className="font-medium text-foreground">Sin visitas registradas</p>
              <p className="text-sm text-muted-foreground mt-1">Registrá la primera visita con el botón de arriba</p>
            </div>
          ) : (
            <>
              <SessionTimeline sessions={sessions} analEvals={analEvals} funcEvals={funcEvals} patientId={id!} onDeleted={fetchAll} />
              {(() => {
                const dischargeSession = sessions.find(s => s.session_type === "discharge");
                if (!dischargeSession) return null;
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 font-medium">
                    ✓ Alta otorgada el {format(new Date(dischargeSession.session_date + "T12:00:00"), "dd/MM/yyyy")} — Objetivos de tratamiento cumplidos
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>

        {/* EVALUATIONS */}
        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button variant={evalSubTab === "functional" ? "default" : "outline"} size="sm" onClick={() => setEvalSubTab("functional")}>Funcional</Button>
            <Button variant={evalSubTab === "analytical" ? "default" : "outline"} size="sm" onClick={() => setEvalSubTab("analytical")}>Analítica</Button>
          </div>

          {evalSubTab === "functional" && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-foreground">Evaluaciones Funcionales</h2>
                <Button onClick={() => setShowNewFuncEval(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Evaluación</Button>
              </div>
              {funcEvals.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sin evaluaciones funcionales.</p> : (
                <FuncEvalList evaluations={funcEvals} />
              )}
            </>
          )}

          {evalSubTab === "analytical" && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-foreground">Evaluaciones Analíticas</h2>
              </div>
              <AnalEvalList evaluations={analEvals} patientId={id!} />
              <p className="text-xs text-muted-foreground text-center mt-2">Las evaluaciones analíticas se registran desde el tab Sesiones</p>
            </>
          )}
        </TabsContent>

        <TabsContent value="archivos" className="space-y-6">
          {/* Archivos clínicos */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Archivos clínicos</h3>
              <Button onClick={() => setShowUploadFile(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Agregar archivo</Button>
            </div>
          </div>
          {/* Fotos de evolución */}
          <div>
            <h3 className="font-medium text-foreground mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Fotos de evolución</h3>
            {(() => {
              const photos = clinicalFiles.filter(f => f.category === "photo");
              if (photos.length === 0) return <p className="text-muted-foreground text-sm text-center py-6">Sin fotos de evolución. Agregá la primera foto.</p>;
              if (loadingUrls) return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map(p => <Skeleton key={p.id} className="h-48 w-full rounded-lg" />)}
                </div>
              );
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map(p => (
                    <div key={p.id} className="relative group rounded-lg border border-border/50 overflow-hidden bg-muted">
                      {signedUrls[p.id] ? (
                        <img
                          src={signedUrls[p.id]}
                          alt={p.description || p.file_name}
                          className="w-full h-48 object-cover cursor-zoom-in"
                          onClick={() => setLightboxPhoto({ url: signedUrls[p.id], description: p.description, date: p.photo_date })}
                        />
                      ) : (
                        <div className="w-full h-48 flex items-center justify-center text-muted-foreground text-sm">Sin vista previa</div>
                      )}
                      <button
                        onClick={() => setDeleteFile(p)}
                        className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="p-2">
                        <p className="font-medium text-sm text-foreground">{format(new Date(p.photo_date), "dd/MM/yyyy")}</p>
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="border-t border-border/50" />
          {/* Documentos y estudios */}
          <div>
            <h3 className="font-medium text-foreground mb-3">Documentos y estudios</h3>
            {(() => {
              const docs = clinicalFiles.filter(f => f.category === "study" || f.category === "document");
              if (docs.length === 0) return <p className="text-muted-foreground text-sm text-center py-6">Sin documentos ni estudios.</p>;
              return (
                <div className="space-y-2">
                  {docs.map(d => (
                    <Card key={d.id} className="border-border/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{d.category === "study" ? "🔬" : "📄"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{d.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.category === "study" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}>
                              {d.category === "study" ? "Estudio" : "Documento"}
                            </span>
                            <span className="text-xs text-muted-foreground">{format(new Date(d.photo_date), "dd/MM/yyyy")}</span>
                          </div>
                          {d.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {signedUrls[d.id] && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={signedUrls[d.id]} download={d.file_name} rel="noopener noreferrer" aria-label={`Descargar ${d.file_name}`}>
                              <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteFile(d)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* APPOINTMENTS */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-foreground">Turnos</h2>
            <Button onClick={() => setShowNewAppt(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Turno</Button>
          </div>
          {appointments.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sin turnos.</p> : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <Card key={a.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {format(new Date(a.appointment_date), "dd/MM/yyyy HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">{appointmentTypeMap[a.type] || a.type}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ADMINISTRACIÓN — Archivos + Turnos */}
        <TabsContent value="admin" className="space-y-6">
          {/* Turnos */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Turnos</h3>
              <Button onClick={() => setShowNewAppt(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Turno</Button>
            </div>
            {appointments.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">Sin turnos.</p> : (
              <div className="space-y-2">
                {appointments.slice(0, 10).map((a) => (
                  <Card key={a.id} className="border-border/50">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {format(new Date(a.appointment_date), "dd/MM/yyyy HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground">{appointmentTypeMap[a.type] || a.type}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border/50" />
          {/* Informe de Alta */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Informe de Alta</h3>
              <Button
                size="sm"
                className="gap-2"
                disabled={!activeEpisodeId || sessions.length === 0}
                onClick={() => setShowDischargeReport(true)}
              >
                <FileText className="h-4 w-4" />
                Generar Informe de Alta
              </Button>
            </div>
            {(!activeEpisodeId || sessions.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-4">
                {!activeEpisodeId
                  ? "No hay episodio activo."
                  : "El episodio no tiene sesiones cargadas."}
              </p>
            )}
          </div>
        </TabsContent>
          </Tabs>
          </div>{/* closes inner scroll div */}
        </div>{/* closes center panel */}

        {/* Context panel — 3rd column (collapsible) */}
        {contextOpen && (
          <div className="w-[260px] shrink-0 border-l border-border overflow-y-auto hidden xl:flex flex-col">
            <div className="px-5 py-3 border-b border-border bg-muted shrink-0">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Contexto</h3>
            </div>

            {/* Últimas 3 sesiones */}
            <div className="p-5 border-b border-border/60">
              <p className="field-label mb-3">Últimas sesiones</p>
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin sesiones registradas.</p>
              ) : (
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((s: any) => (
                    <div key={s.id} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {({admission: "Admisión", follow_up: "Seguimiento", discharge: "Alta"} as any)[s.session_type] || s.session_type}
                        </p>
                        {s.session_number && <p className="text-[10px] text-muted-foreground">Sesión {s.session_number}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {format(new Date(s.session_date + "T12:00:00"), "dd/MM/yy")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Próximo turno */}
            <div className="p-5 border-b border-border/60">
              <p className="field-label mb-3">Próximo turno</p>
              {nextApptUpcoming ? (
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {format(new Date(nextApptUpcoming.appointment_date), "d MMM yyyy", { locale: es })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(nextApptUpcoming.appointment_date), "HH:mm")} · {
                      ({consultation: "Consulta", follow_up: "Seguimiento", evaluation: "Evaluación", admission: "Admisión", discharge: "Alta"} as any)[nextApptUpcoming.type] || nextApptUpcoming.type
                    }
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin turnos próximos.</p>
              )}
            </div>

            {/* Evaluaciones funcionales */}
            {funcEvals.length > 0 && (
              <div className="p-5">
                <p className="field-label mb-3">Escalas ({funcEvals.length})</p>
                <div className="space-y-2.5">
                  {funcEvals.slice(0, 4).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {format(new Date(e.evaluation_date + "T12:00:00"), "dd/MM/yy")}
                      </p>
                      {e.evaluation_type && (
                        <span className="text-[10px] font-medium text-foreground">{e.evaluation_type}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>{/* closes flex flex-1 min-h-0 */}

      {/* Dialogs rendered outside the panels */}
      <NewEpisodeDialog open={showNewEpisode} onClose={() => setShowNewEpisode(false)} patientId={id!} userId={user!.id} episodes={episodes} onSaved={async (newEpId: string) => {
        setActiveEpisodeId(newEpId);
        await fetchPatientBase();
        await fetchEpisodeData(newEpId);
      }} />
      <EditFichaDialog open={showEditFicha} onClose={() => setShowEditFicha(false)} patient={patient} clinical={clinical} occupational={occupational} activeEpisodeId={activeEpisodeId} onSaved={fetchAll} />
      <NewFuncEvalDialog open={showNewFuncEval} onClose={() => setShowNewFuncEval(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      
      <NewPatientApptDialog open={showNewAppt} onClose={() => setShowNewAppt(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <NewPlanDialog open={showNewPlan} onClose={() => setShowNewPlan(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <PlanDetailDialog plan={showPlanDetail} onClose={() => setShowPlanDetail(null)} />
      <EditPlanDialog plan={editPlan} onClose={() => setEditPlan(null)} patientId={id!} userId={user!.id} onSaved={fetchAll} />
      <DeletePlanConfirm plan={deletePlan} onClose={() => setDeletePlan(null)} onSaved={fetchAll} />
      <UploadFileDialog open={showUploadFile} onClose={() => setShowUploadFile(false)} patientId={id!} userId={user!.id} onSaved={fetchAll} episodeId={activeEpisodeId} />
      <DeleteFileConfirm file={deleteFile} onClose={() => setDeleteFile(null)} onDeleted={(fileId) => {
        setClinicalFiles(prev => prev.filter(f => f.id !== fileId));
        setSignedUrls(prev => { const n = { ...prev }; delete n[fileId]; return n; });
      }} />
      <DischargeReportModal
        open={showDischargeReport}
        onOpenChange={(o) => { if (!o) { dischargeReport.reset(); } setShowDischargeReport(o); }}
        state={dischargeReport.state}
        reportText={dischargeReport.reportText}
        setReportText={dischargeReport.setReportText}
        onGenerate={dischargeReport.generate}
        onReset={dischargeReport.reset}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : ""}
      />

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => { if (!open) setLightboxPhoto(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-gray-800 flex flex-col items-center justify-center gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto ampliada</DialogTitle>
            <DialogDescription>Vista ampliada de la imagen</DialogDescription>
          </DialogHeader>
          {lightboxPhoto && (
            <>
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.description || "Foto"}
                className="max-w-full max-h-[80vh] object-contain"
              />
              {(lightboxPhoto.date || lightboxPhoto.description) && (
                <div className="w-full px-4 py-2 text-center space-y-0.5">
                  {lightboxPhoto.date && (
                    <p className="text-xs text-gray-400">{format(new Date(lightboxPhoto.date), "dd/MM/yyyy")}</p>
                  )}
                  {lightboxPhoto.description && (
                    <p className="text-sm text-gray-200">{lightboxPhoto.description}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


function EditFichaDialog({ open, onClose, patient, clinical, occupational, activeEpisodeId, onSaved }: { open: boolean; onClose: () => void; patient: any; clinical: any; occupational: any; activeEpisodeId: string | null; onSaved: () => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      first_name: patient?.first_name || "",
      last_name: patient?.last_name || "",
      dni: patient?.dni || "",
      birth_date: patient?.birth_date || "",
      gender: patient?.gender || "",
      phone: patient?.phone || "",
      email: patient?.email || "",
      address: patient?.address || "",
      insurance: patient?.insurance || "",
      insurance_number: patient?.insurance_number || "",
      admission_date: patient?.admission_date || "",
      emergency_contact_name: patient?.emergency_contact_name || "",
      emergency_contact_phone: patient?.emergency_contact_phone || "",
      emergency_contact_relation: patient?.emergency_contact_relation || "",
      diagnosis: clinical?.diagnosis || "",
      treatment_type: clinical?.treatment_type || "",
      injury_date: clinical?.injury_date || "",
      surgery_date: clinical?.surgery_date || "",
      symptom_start_date: clinical?.symptom_start_date || "",
      injury_mechanism: clinical?.injury_mechanism || "",
      current_treatment: clinical?.current_treatment || "",
      pharmacological_treatment: clinical?.pharmacological_treatment || "",
      medical_history: clinical?.medical_history || "",
      studies: clinical?.studies || "",
      doctor_name: clinical?.doctor_name || "",
      immobilization_type: clinical?.immobilization_type || "",
      immobilization_weeks: clinical?.immobilization_weeks ?? "",
      immobilization_days: clinical?.immobilization_days ?? "",
      next_oyt_appointment: clinical?.next_oyt_appointment || "",
      clinical_notes: clinical?.notes || "",
      dominance: occupational?.dominance || "",
      job: occupational?.job || "",
      education: occupational?.education || "",
      support_network: occupational?.support_network || "",
      leisure: occupational?.leisure || "",
      physical_activity: occupational?.physical_activity || "",
      sleep_rest: occupational?.sleep_rest || "",
      occupational_notes: occupational?.notes || "",
    });
  }, [open, patient, clinical, occupational]);

  const u = (field: string, value: string) => setForm((prev: any) => ({ ...prev, [field]: value }));
  const emptyToNull = (v: any) => v === "" || v === undefined ? null : v;
  const numberOrNull = (v: any) => v === "" || v === undefined ? null : parseInt(v);

  const handleSave = async () => {
    if (!patient?.id || !user) return;
    setSaving(true);
    const patientPayload = {
      first_name: form.first_name,
      last_name: form.last_name,
      dni: form.dni,
      birth_date: emptyToNull(form.birth_date),
      gender: emptyToNull(form.gender),
      phone: emptyToNull(form.phone),
      email: emptyToNull(form.email),
      address: emptyToNull(form.address),
      insurance: emptyToNull(form.insurance),
      insurance_number: emptyToNull(form.insurance_number),
      admission_date: form.admission_date || patient.admission_date,
      emergency_contact_name: emptyToNull(form.emergency_contact_name),
      emergency_contact_phone: emptyToNull(form.emergency_contact_phone),
      emergency_contact_relation: emptyToNull(form.emergency_contact_relation),
    };
    const clinicalPayload = {
      patient_id: patient.id,
      episode_id: activeEpisodeId,
      diagnosis: emptyToNull(form.diagnosis),
      treatment_type: emptyToNull(form.treatment_type),
      injury_date: emptyToNull(form.injury_date),
      surgery_date: emptyToNull(form.surgery_date),
      symptom_start_date: emptyToNull(form.symptom_start_date),
      injury_mechanism: emptyToNull(form.injury_mechanism),
      current_treatment: emptyToNull(form.current_treatment),
      pharmacological_treatment: emptyToNull(form.pharmacological_treatment),
      medical_history: emptyToNull(form.medical_history),
      studies: emptyToNull(form.studies),
      doctor_name: emptyToNull(form.doctor_name),
      immobilization_type: emptyToNull(form.immobilization_type),
      immobilization_weeks: numberOrNull(form.immobilization_weeks),
      immobilization_days: numberOrNull(form.immobilization_days),
      next_oyt_appointment: emptyToNull(form.next_oyt_appointment),
      notes: emptyToNull(form.clinical_notes),
    } as any;
    const occupationalPayload = {
      patient_id: patient.id,
      dominance: emptyToNull(form.dominance),
      job: emptyToNull(form.job),
      education: emptyToNull(form.education),
      support_network: emptyToNull(form.support_network),
      leisure: emptyToNull(form.leisure),
      physical_activity: emptyToNull(form.physical_activity),
      sleep_rest: emptyToNull(form.sleep_rest),
      notes: emptyToNull(form.occupational_notes),
    } as any;

    const patientRes = await supabase.from("patients").update(patientPayload).eq("id", patient.id);
    const clinicalRes = clinical?.id
      ? await supabase.from("patient_clinical_records").update(clinicalPayload).eq("id", clinical.id)
      : await supabase.from("patient_clinical_records").insert(clinicalPayload);
    const occupationalRes = occupational?.id
      ? await supabase.from("patient_occupational_profiles").update(occupationalPayload).eq("id", occupational.id)
      : await supabase.from("patient_occupational_profiles").insert(occupationalPayload);

    setSaving(false);
    if (patientRes.error || clinicalRes.error || occupationalRes.error) {
      toast.error("Error al actualizar la ficha");
      return;
    }
    toast.success("Ficha actualizada correctamente");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ficha</DialogTitle>
          <DialogDescription className="sr-only">Formulario para editar datos del paciente y ficha clínica</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Datos personales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={form.first_name || ""} onChange={(e) => u("first_name", e.target.value)} /></div>
              <div><Label>Apellido</Label><Input value={form.last_name || ""} onChange={(e) => u("last_name", e.target.value)} /></div>
              <div><Label>DNI</Label><Input value={form.dni || ""} onChange={(e) => u("dni", e.target.value)} /></div>
              <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birth_date || ""} onChange={(e) => u("birth_date", e.target.value)} /></div>
              <div><Label>Género</Label><Select value={form.gender || ""} onValueChange={(v) => u("gender", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="female">Femenino</SelectItem><SelectItem value="male">Masculino</SelectItem><SelectItem value="other">Otro</SelectItem><SelectItem value="no_data">Prefiero no decir</SelectItem></SelectContent></Select></div>
              <div><Label>Teléfono</Label><Input value={form.phone || ""} onChange={(e) => u("phone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => u("email", e.target.value)} /></div>
              <div><Label>Obra social</Label><Input value={form.insurance || ""} onChange={(e) => u("insurance", e.target.value)} /></div>
              <div><Label>Nº de afiliado</Label><Input value={form.insurance_number || ""} onChange={(e) => u("insurance_number", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Dirección</Label><Input value={form.address || ""} onChange={(e) => u("address", e.target.value)} /></div>
              <div><Label>Fecha de admisión</Label><Input type="date" value={form.admission_date || ""} onChange={(e) => u("admission_date", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Contacto de emergencia</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre completo</Label><Input value={form.emergency_contact_name || ""} onChange={(e) => u("emergency_contact_name", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={form.emergency_contact_phone || ""} onChange={(e) => u("emergency_contact_phone", e.target.value)} /></div>
              <div><Label>Relación</Label><Select value={form.emergency_contact_relation || ""} onValueChange={(v) => u("emergency_contact_relation", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="parent">Padre / Madre</SelectItem><SelectItem value="spouse">Cónyuge / Pareja</SelectItem><SelectItem value="sibling">Hermano/a</SelectItem><SelectItem value="child">Hijo/a</SelectItem><SelectItem value="friend">Amigo/a</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Datos clínicos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Diagnóstico</Label><Input value={form.diagnosis || ""} onChange={(e) => u("diagnosis", e.target.value)} /></div>
              <div><Label>Tipo de tratamiento</Label><Select value={form.treatment_type || ""} onValueChange={(v) => u("treatment_type", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="conservative">Conservador</SelectItem><SelectItem value="surgery">Quirúrgico</SelectItem><SelectItem value="mixed">Mixto</SelectItem></SelectContent></Select></div>
              <div><Label>Médico</Label><Input value={form.doctor_name || ""} onChange={(e) => u("doctor_name", e.target.value)} /></div>
              <div><Label>Fecha lesión</Label><Input type="date" value={form.injury_date || ""} onChange={(e) => u("injury_date", e.target.value)} /></div>
              <div><Label>Fecha cirugía</Label><Input type="date" value={form.surgery_date || ""} onChange={(e) => u("surgery_date", e.target.value)} /></div>
              <div><Label>Inicio síntomas</Label><Input type="date" value={form.symptom_start_date || ""} onChange={(e) => u("symptom_start_date", e.target.value)} /></div>
              <div><Label>Tipo inmovilización</Label><Input value={form.immobilization_type || ""} onChange={(e) => u("immobilization_type", e.target.value)} /></div>
              <div><Label>Próximo OyT</Label><Input type="date" value={form.next_oyt_appointment || ""} onChange={(e) => u("next_oyt_appointment", e.target.value)} /></div>
              <div><Label>Semanas inmovilización</Label><Input type="number" value={form.immobilization_weeks || ""} onChange={(e) => u("immobilization_weeks", e.target.value)} /></div>
              <div><Label>Días inmovilización</Label><Input type="number" value={form.immobilization_days || ""} onChange={(e) => u("immobilization_days", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Mecanismo de lesión</Label><Textarea value={form.injury_mechanism || ""} onChange={(e) => u("injury_mechanism", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Tratamiento actual</Label><Textarea value={form.current_treatment || ""} onChange={(e) => u("current_treatment", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Tratamiento farmacológico</Label><Textarea value={form.pharmacological_treatment || ""} onChange={(e) => u("pharmacological_treatment", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Antecedentes</Label><Textarea value={form.medical_history || ""} onChange={(e) => u("medical_history", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Estudios</Label><Textarea value={form.studies || ""} onChange={(e) => u("studies", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Notas clínicas</Label><Textarea value={form.clinical_notes || ""} onChange={(e) => u("clinical_notes", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Perfil ocupacional</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Lateralidad</Label><Select value={form.dominance || ""} onValueChange={(v) => u("dominance", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="right">Diestro/a</SelectItem><SelectItem value="left">Zurdo/a</SelectItem><SelectItem value="ambidextrous">Ambidiestro/a</SelectItem></SelectContent></Select></div>
              <div><Label>Trabajo</Label><Input value={form.job || ""} onChange={(e) => u("job", e.target.value)} /></div>
              <div><Label>Educación</Label><Input value={form.education || ""} onChange={(e) => u("education", e.target.value)} /></div>
              <div><Label>Red de apoyo</Label><Input value={form.support_network || ""} onChange={(e) => u("support_network", e.target.value)} /></div>
              <div><Label>Ocio</Label><Textarea value={form.leisure || ""} onChange={(e) => u("leisure", e.target.value)} /></div>
              <div><Label>Actividad física</Label><Textarea value={form.physical_activity || ""} onChange={(e) => u("physical_activity", e.target.value)} /></div>
              <div><Label>Sueño y descanso</Label><Textarea value={form.sleep_rest || ""} onChange={(e) => u("sleep_rest", e.target.value)} /></div>
              <div><Label>Notas ocupacionales</Label><Textarea value={form.occupational_notes || ""} onChange={(e) => u("occupational_notes", e.target.value)} /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.dni}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Session Timeline ---

// ---------------------------------------------------------------------------
// MeasurementsBlock — Renders structured "Mediciones del día" with sub-sections
// ---------------------------------------------------------------------------
const TEST_LABELS: Record<string, string> = {
  finkelstein: "Finkelstein",
  phalen: "Phalen",
  froment: "Froment",
  wartenberg: "Wartenberg",
  garra_cubital: "Garra cubital",
  jobe: "Jobe",
  pate: "Pate",
  yocum: "Yocum",
  herber: "Herber",
};

const FINGER_LABELS: Record<string, string> = {
  thumb: "Pulgar",
  index: "Índice",
  middle: "Medio",
  ring: "Anular",
  pinky: "Meñique",
  pulgar: "Pulgar",
  indice: "Índice",
  índice: "Índice",
  medio: "Medio",
  anular: "Anular",
  menique: "Meñique",
  meñique: "Meñique",
};

const SCAR_LABELS: Record<string, string> = {
  location: "Localización",
  localizacion: "Localización",
  length: "Longitud",
  longitud: "Longitud",
  longitud_cm: "Longitud",
  sensitivity: "Sensibilidad",
  sensibilidad: "Sensibilidad",
  temperature: "Temperatura",
  temperatura: "Temperatura",
  observations: "Observaciones",
  observaciones: "Observaciones",
  notes: "Observaciones",
};

const VSS_LABELS: Record<string, string> = {
  pigmentation: "Pigmentación",
  pigmentacion: "Pigmentación",
  vascularization: "Vascularización",
  vascularizacion: "Vascularización",
  pliability: "Flexibilidad",
  flexibility: "Flexibilidad",
  flexibilidad: "Flexibilidad",
  height: "Altura",
  altura: "Altura",
};

const PART_NAMES: Record<string, string> = {
  shoulder: "Hombro",
  elbow: "Codo",
  wrist: "Muñeca",
  hand: "Mano",
  thumb: "Pulgar",
};

function MeasurementsBlock({ e }: { e: any }) {
  const nn = (v: any) => v != null && v !== "";

  const SubSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="border-l-2 border-primary/30 pl-3 py-1 space-y-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="space-y-1 text-sm text-foreground">{children}</div>
    </div>
  );

  const FieldLine = ({ label, value }: { label: string; value: any }) => {
    if (!nn(value)) return null;
    return (
      <p className="text-sm whitespace-pre-wrap"><span className="font-medium text-gray-700">{label}:</span> {value}</p>
    );
  };

  // ---------- DOLOR ----------
  const evaColor = (n: number) =>
    n <= 3 ? "bg-green-100 text-green-700 border-green-200"
    : n <= 6 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200";

  const hasPain = nn(e.pain_score) || nn(e.pain_appearance) || nn(e.pain_location)
    || nn(e.pain_radiation) || nn(e.pain_characteristics) || nn(e.pain_aggravating_factors) || nn(e.pain);

  // ---------- EDEMA ----------
  const hasEdema = nn(e.edema) || nn(e.edema_circummetry) || nn(e.godet_test);

  // ---------- MOVILIDAD ----------
  const renderGonio = () => {
    const g = e.goniometry;
    if (!g || typeof g !== "object") return [];
    const parts: JSX.Element[] = [];
    const renderEntry = (which: "pre" | "post", side: string | null, data: any) => {
      if (!data || !data.values || typeof data.values !== "object") return null;
      const vals = Object.entries(data.values).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k} ${v}°`);
      if (vals.length === 0) return null;
      const partLabel = PART_NAMES[data.body_part] || data.body_part || "";
      const key = `${side || ""}-${which}-${partLabel}`;
      return (
        <p key={key} className="text-sm">
          {side && <span className="font-medium text-gray-700">[{side}]</span>}{" "}
          <span className="font-medium text-gray-700">[{partLabel}]</span>{" "}
          <span className="text-xs font-semibold text-gray-500 uppercase">{which.toUpperCase()}:</span>{" "}
          {vals.join(" · ")}
        </p>
      );
    };
    if (g.MSD || g.MSI) {
      (["MSD", "MSI"] as const).forEach((side) => {
        const sideData = g[side];
        if (!sideData) return;
        (Array.isArray(sideData.pre) ? sideData.pre : []).forEach((d: any) => { const n = renderEntry("pre", side, d); if (n) parts.push(n); });
        (Array.isArray(sideData.post) ? sideData.post : []).forEach((d: any) => { const n = renderEntry("post", side, d); if (n) parts.push(n); });
      });
    } else {
      (Array.isArray(g.pre) ? g.pre : (g.pre ? [g.pre] : [])).forEach((d: any) => { const n = renderEntry("pre", null, d); if (n) parts.push(n); });
      (Array.isArray(g.post) ? g.post : (g.post ? [g.post] : [])).forEach((d: any) => { const n = renderEntry("post", null, d); if (n) parts.push(n); });
    }
    return parts;
  };
  const gonioParts = renderGonio();
  const hasMobility = gonioParts.length > 0 || nn(e.arom) || nn(e.prom) || nn(e.kapandji);
  // Detect "cierre de puño" inside arom/prom strings (no dedicated column)
  // Render arom/prom as fallback if no jsonb goniometry
  const showAromFallback = gonioParts.length === 0 && (nn(e.arom) || nn(e.prom));

  // ---------- FUERZA ----------
  const renderDppd = () => {
    const f = e.dppd_fingers;
    if (!f || typeof f !== "object") return null;
    const entries = Object.entries(f).filter(([, v]) => nn(v));
    if (entries.length === 0) return null;
    return (
      <p className="text-sm">
        <span className="font-medium text-gray-700">DPPD:</span>{" "}
        {entries.map(([k, v]) => `${FINGER_LABELS[k] || k}: ${v}cm`).join(", ")}
      </p>
    );
  };
  const dppdNode = renderDppd();
  const hasDppdJson = dppdNode !== null;

  const renderNerve = (label: string, raw: any) => {
    if (raw == null || raw === "") return null;
    let obj: any = raw;
    if (typeof raw === "string") {
      try { obj = JSON.parse(raw); }
      catch { return <p key={label} className="text-sm"><span className="font-medium text-gray-700">{label}:</span> {raw}</p>; }
    }
    if (!obj || typeof obj !== "object") {
      return <p key={label} className="text-sm"><span className="font-medium text-gray-700">{label}:</span> {String(raw)}</p>;
    }
    const entries = Object.entries(obj).filter(([, v]) => nn(v));
    if (entries.length === 0) return null;
    return (
      <p key={label} className="text-sm">
        <span className="font-medium text-gray-700">{label}:</span>{" "}
        {entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")}
      </p>
    );
  };
  const danielsArr: { muscle: string; grade: string }[] = (() => {
    const raw = e.muscle_strength_daniels;
    if (!raw) return [];
    let arr: any = raw;
    if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return []; } }
    if (!Array.isArray(arr)) return [];
    return arr.filter((r: any) => r && typeof r === "object" && r.muscle && r.grade);
  })();
  const hasDaniels = danielsArr.length > 0;
  const hasStrength = nn(e.dynamometer_msd) || nn(e.dynamometer_msi)
    || nn(e.muscle_strength) || hasDppdJson || hasDaniels;

  // ---------- SENSIBILIDAD ----------
  const hasSensitivity = !!(e.sensitivity_tacto_ligero || e.sensitivity_dos_puntos || e.sensitivity_picking_up || e.sensitivity_semmes_weinstein || e.sensitivity_toco_pincho || e.sensitivity_temperatura || e.sensitivity);

  // ---------- PRUEBAS ESPECÍFICAS ----------
  const renderTests = () => {
    const t = e.specific_tests;
    if (!t || typeof t !== "object") return null;
    const filled = Object.entries(t).filter(([, v]) => v === "positive" || v === "negative");
    if (filled.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {filled.map(([name, result]) => (
          <span
            key={name}
            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              result === "positive"
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-green-100 text-green-700 border-green-200"
            }`}
          >
            {TEST_LABELS[name] || name} {result === "positive" ? "+" : "−"}
          </span>
        ))}
      </div>
    );
  };
  const testsNode = renderTests();
  const hasTests = testsNode !== null;

  // ---------- CICATRIZ ----------
  const renderScar = () => {
    const s = e.scar_evaluation;
    if (!s || typeof s !== "object") return { fields: [] as JSX.Element[], vss: null as JSX.Element | null };
    const fieldOrder = ["location", "localizacion", "length", "longitud", "longitud_cm",
      "sensitivity", "sensibilidad",
      "temperature", "temperatura", "observations", "observaciones", "notes"];
    const seen = new Set<string>();
    const fields: JSX.Element[] = [];
    fieldOrder.forEach((k) => {
      const labelKey = SCAR_LABELS[k];
      if (!labelKey || seen.has(labelKey)) return;
      const v = s[k];
      if (!nn(v)) return;
      seen.add(labelKey);
      fields.push(<FieldLine key={k} label={labelKey} value={v} />);
    });

    // VSS sub-scores
    const vssSrc = s.vss || s.vancouver || s;
    const vssParts: string[] = [];
    ["pigmentation", "pigmentacion", "vascularization", "vascularizacion", "pliability", "flexibility", "flexibilidad", "height", "altura"].forEach((k) => {
      const lbl = VSS_LABELS[k];
      if (!lbl) return;
      const v = vssSrc?.[k];
      if (v == null || v === "") return;
      if (vssParts.find(p => p.startsWith(lbl + ":"))) return;
      vssParts.push(`${lbl}: ${v}`);
    });
    const vssNode = vssParts.length > 0
      ? <p className="text-xs text-gray-600">{vssParts.join(" | ")}</p>
      : null;

    return { fields, vss: vssNode };
  };
  const scarRendered = renderScar();
  const hasScar = scarRendered.fields.length > 0 || nn(e.scar) || nn(e.vancouver_score) || scarRendered.vss !== null;

  // ---------- OTROS ----------
  const hasOthers = nn(e.trophic_state) || nn(e.posture) || nn(e.emotional_state);

  const hasAny = hasPain || hasEdema || hasMobility || hasStrength || hasSensitivity
    || hasTests || hasScar || hasOthers || nn(e.osas_score) || nn(e.notes);

  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-lg border border-border/40 p-3 space-y-3">
      {hasPain && (
        <SubSection label="Dolor">
          {nn(e.pain_score) && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">EVA</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${evaColor(Number(e.pain_score))}`}>
                {e.pain_score}/10
              </span>
            </div>
          )}
          <FieldLine label="Aparición" value={e.pain_appearance} />
          <FieldLine label="Localización" value={e.pain_location} />
          <FieldLine label="Irradiación" value={e.pain_radiation} />
          <FieldLine label="Características" value={e.pain_characteristics} />
          <FieldLine label="Agravantes" value={e.pain_aggravating_factors} />
          {nn(e.pain) && <p className="text-sm text-muted-foreground italic">{e.pain}</p>}
        </SubSection>
      )}

      {hasEdema && (
        <SubSection label="Edema">
          <FieldLine label="Observación" value={e.edema} />
          {(() => {
            const c: any = e.edema_circummetry;
            if (!nn(c)) return null;
            if (isCircometriaFormat(c)) {
              const items = normalizeCircometriaValue(c);
              if (items.length === 0) return null;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground">Reparo anatómico</th>
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground">MSD</th>
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground">MSI</th>
                        <th className="text-center py-1 px-2 font-medium text-muted-foreground">Dif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const d = parseFloat(item.msd), s = parseFloat(item.msi);
                        const dif = !isNaN(d) && !isNaN(s) ? `${(s - d) >= 0 ? "+" : ""}${(s - d).toFixed(1)}` : "—";
                        return (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-0.5 px-2">{item.reparo || "—"}</td>
                            <td className="py-0.5 px-2">{item.msd ? `${item.msd} cm` : "—"}</td>
                            <td className="py-0.5 px-2">{item.msi ? `${item.msi} cm` : "—"}</td>
                            <td className="py-0.5 px-2 text-center">{dif}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (isNewEdemaFormat(c)) {
              const norm = normalizeEdemaValue(c);
              const sanoEntries = EDEMA_POINTS.filter(p => norm.sano[p.key] != null && norm.sano[p.key] !== "");
              const afEntries = EDEMA_POINTS.filter(p => norm.afectado[p.key] != null && norm.afectado[p.key] !== "");
              if (sanoEntries.length === 0 && afEntries.length === 0) return null;
              const showSano = sanoEntries.length > 0;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground">Punto</th>
                        {showSano && <th className="text-left py-1 px-2 font-medium text-muted-foreground">MS Sano{norm.sano.fecha ? ` (${norm.sano.fecha})` : ""}</th>}
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground">MS Afectado{norm.afectado.fecha ? ` (${norm.afectado.fecha})` : ""}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EDEMA_POINTS.map(p => {
                        const s = norm.sano[p.key], a = norm.afectado[p.key];
                        if ((s == null || s === "") && (a == null || a === "")) return null;
                        return (
                          <tr key={p.key} className="border-b border-border/40">
                            <td className="py-0.5 px-2">{p.label}</td>
                            {showSano && <td className="py-0.5 px-2">{s != null && s !== "" ? `${s} cm` : "—"}</td>}
                            <td className="py-0.5 px-2">{a != null && a !== "" ? `${a} cm` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (typeof c === "object") {
              if (!nn(c.reference) && !nn(c.value_cm)) return null;
              const txt = `${c.reference || ""}${c.side ? ` (${c.side})` : ""}${nn(c.value_cm) ? ` — ${c.value_cm} cm` : ""}${c.mano_global ? " · Mano global" : ""}`.trim();
              return <FieldLine label="Circometría" value={txt} />;
            }
            return <FieldLine label="Circometría" value={c} />;
          })()}
          <FieldLine label="Godet" value={e.godet_test} />
        </SubSection>
      )}

      {hasMobility && (
        <SubSection label="Movilidad">
          {gonioParts.length > 0 && <div className="space-y-0.5">{gonioParts}</div>}
          {showAromFallback && (
            <>
              {nn(e.arom) && <FieldLine label="Goniometría PRE" value={e.arom} />}
              {nn(e.prom) && <FieldLine label="Goniometría POST" value={e.prom} />}
            </>
          )}
          <FieldLine label="Kapandji" value={e.kapandji} />
        </SubSection>
      )}

      {hasStrength && (
        <SubSection label="Fuerza muscular">
          {(() => {
            const renderDyn = (side: "MSD" | "MSI", raw: any) => {
              if (!nn(raw)) return null;
              if (typeof raw === "object" && raw && (Array.isArray(raw.values) || nn(raw.average))) {
                const vals = (raw.values || []).map((v: any) => (nn(v) ? v : "—")).join(" / ");
                return `${side}: ${vals} kgf → Promedio: ${raw.average ?? "—"} kgf`;
              }
              return `${side} ${raw}kg`;
            };
            const msd = renderDyn("MSD", e.dynamometer_msd);
            const msi = renderDyn("MSI", e.dynamometer_msi);
            if (!msd && !msi) return null;
            return (
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-700">Dinamómetro:</p>
                {msd && <p className="text-sm">{msd}</p>}
                {msi && <p className="text-sm">{msi}</p>}
              </div>
            );
          })()}
          {!hasDppdJson && <FieldLine label="Fuerza muscular" value={e.muscle_strength} />}
          {dppdNode}
          {hasDaniels && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Daniels — Músculos evaluados</p>
              <div className="space-y-0.5">
                {danielsArr.map((r, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium text-gray-700">{r.muscle}:</span> Daniels {r.grade}
                  </p>
                ))}
              </div>
            </div>
          )}
          {hasDppdJson && nn(e.muscle_strength) && <FieldLine label="Notas" value={e.muscle_strength} />}
        </SubSection>
      )}

      {hasSensitivity && (
        <SubSection label="Sensibilidad">
          {(e.sensitivity_tacto_ligero || e.sensitivity_dos_puntos || e.sensitivity_picking_up || e.sensitivity_semmes_weinstein) && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 uppercase">Epicrítica</p>
              {e.sensitivity_tacto_ligero && <FieldLine label="Tacto ligero" value={e.sensitivity_tacto_ligero} />}
              {e.sensitivity_dos_puntos && <FieldLine label="Discriminación 2 puntos" value={e.sensitivity_dos_puntos} />}
              {e.sensitivity_picking_up && <FieldLine label="Picking up" value={e.sensitivity_picking_up} />}
              {e.sensitivity_semmes_weinstein && <FieldLine label="Semmes-Weinstein" value={e.sensitivity_semmes_weinstein} />}
            </div>
          )}
          {(e.sensitivity_toco_pincho || e.sensitivity_temperatura) && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 uppercase">Protopática</p>
              {e.sensitivity_toco_pincho && <FieldLine label="Toco-pincho" value={e.sensitivity_toco_pincho} />}
              {e.sensitivity_temperatura && <FieldLine label="Temperatura" value={e.sensitivity_temperatura} />}
            </div>
          )}
          {e.sensitivity && <p className="text-sm text-muted-foreground italic">{e.sensitivity}</p>}
        </SubSection>
      )}

      {hasScar && (
        <SubSection label="Cicatriz">
          {scarRendered.fields}
          {scarRendered.fields.length === 0 && nn(e.scar) && <p className="text-sm whitespace-pre-wrap">{e.scar}</p>}
          {scarRendered.vss}
          {nn(e.vancouver_score) && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
              VSS: {e.vancouver_score}/15
            </span>
          )}
        </SubSection>
      )}

      {hasTests && (
        <SubSection label="Pruebas específicas">
          {testsNode}
        </SubSection>
      )}

      {hasOthers && (
        <SubSection label="Otros">
          <FieldLine label="Estado trófico" value={e.trophic_state} />
          <FieldLine label="Postura" value={e.posture} />
          <FieldLine label="Emotividad" value={e.emotional_state} />
        </SubSection>
      )}

      {nn(e.osas_score) && (
        <p className="text-xs text-muted-foreground">OSAS: {e.osas_score}/60</p>
      )}
      {nn(e.notes) && (
        <p className="text-sm italic text-muted-foreground border-t border-border/30 pt-2">{e.notes}</p>
      )}
    </div>
  );
}

function SessionTimeline({ sessions, analEvals, funcEvals, patientId, onDeleted }: { sessions: any[]; analEvals: any[]; funcEvals: any[]; patientId: string; onDeleted: () => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteSession, setDeleteSession] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const typeLabel: Record<string, string> = { admission: "Admisión", follow_up: "Seguimiento", discharge: "Alta" };
  const typeColor: Record<string, string> = { admission: "border-primary/40 text-primary bg-transparent", follow_up: "border-border text-muted-foreground bg-transparent", discharge: "border-emerald-400 text-emerald-600 bg-transparent" };

  const ordinal = (n: number) => {
    if (n === 1) return "1ra";
    if (n === 2) return "2da";
    if (n === 3) return "3ra";
    if (n === 4) return "4ta";
    if (n === 5) return "5ta";
    return `${n}ma`;
  };

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <p className="field-label mb-2">{children}</p>
  );

  const Line = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-foreground whitespace-pre-wrap">{children}</p>
  );

  const nn = (v: any) => v != null && v !== "";

  const sameDate = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a || !b) return false;
    return a.slice(0, 10) === b.slice(0, 10);
  };

  const matchesSessionEval = (session: any, evaluation: any) => {
    if (evaluation.session_id && evaluation.session_id === session.id) return true;
    if (evaluation.session_id) return false;
    return !!(
      evaluation.episode_id &&
      session.episode_id &&
      evaluation.episode_id === session.episode_id &&
      sameDate(evaluation.evaluation_date, session.session_date)
    );
  };

  const FunctionalEvalBlock = ({ e }: { e: any }) => {
    const hasScores = e.quickdash_score != null || e.fim_score != null;
    const hasFields = nn(e.avd) || nn(e.aivd);
    if (!hasScores && !hasFields) return null;

    return (
      <div className="bg-card rounded-lg border border-border p-3 space-y-3">
        {hasScores && (
          <div className="flex flex-wrap gap-2">
            {e.quickdash_score != null && (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">QuickDASH: {e.quickdash_score}/100</span>
            )}
            {e.fim_score != null && (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-info/10 text-info border border-info/20">FIM: {e.fim_score}/126</span>
            )}
          </div>
        )}
        {hasFields && (
          <div className="border-l-2 border-primary/30 pl-3 py-1 space-y-1">
            {nn(e.avd) && <Line><span className="font-medium text-foreground/70">AVD:</span> {e.avd}</Line>}
            {nn(e.aivd) && <Line><span className="font-medium text-foreground/70">AIVD:</span> {e.aivd}</Line>}
          </div>
        )}
      </div>
    );
  };

  const partNames: Record<string, string> = { shoulder: "Hombro", elbow: "Codo", wrist: "Muñeca", hand: "Mano", thumb: "Pulgar" };

  const renderGonioJsonb = (g: any) => {
    if (!g || typeof g !== "object") return null;
    const renderPart = (label: string, data: any) => {
      if (!data || !data.values || typeof data.values !== "object") return null;
      const vals = Object.entries(data.values).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${v}°`);
      if (vals.length === 0) return null;
      return <Line key={label}>{label} ({partNames[data.body_part] || data.body_part}): {vals.join(" · ")}</Line>;
    };
    return <>{renderPart("Goniometría PRE", g.pre)}{renderPart("Goniometría POST", g.post)}</>;
  };

  const renderSpecificTests = (tests: any) => {
    if (!tests || typeof tests !== "object") return null;
    const filled = Object.entries(tests).filter(([, v]) => nn(v));
    if (filled.length === 0) return null;
    return (
      <div>
        <span className="font-medium text-sm">Pruebas específicas: </span>
        {filled.map(([name, result]) => (
          <span key={name} className={`inline-block text-xs px-1.5 py-0.5 rounded mr-1 mb-0.5 ${result === "positive" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {name} {result === "positive" ? "+" : "−"}
          </span>
        ))}
      </div>
    );
  };

  const renderNerveStrength = (e: any) => {
    const hasAny = nn(e.muscle_strength_median) || nn(e.muscle_strength_cubital) || nn(e.muscle_strength_radial);
    if (!hasAny) return null;
    const renderNerve = (label: string, raw: string) => {
      try {
        const obj = JSON.parse(raw);
        const entries = Object.entries(obj).filter(([,v]) => v);
        if (entries.length === 0) return null;
        return <Line key={label}>{label}: {entries.map(([k,v]) => `${k.replace(/_/g," ")}: ${v}`).join(", ")}</Line>;
      } catch { return <Line>{label}: {raw}</Line>; }
    };
    return <>
      {nn(e.muscle_strength_median) && renderNerve("N. Mediano", e.muscle_strength_median)}
      {nn(e.muscle_strength_cubital) && renderNerve("N. Cubital", e.muscle_strength_cubital)}
      {nn(e.muscle_strength_radial) && renderNerve("N. Radial", e.muscle_strength_radial)}
    </>;
  };

  const handleDeleteSession = async () => {
    if (!deleteSession || deleteSession.session_type === "admission") return;
    setDeleting(true);
    const wasDischarge = deleteSession.session_type === "discharge";
    const episodeId = deleteSession.episode_id;

    // Usar RPC SECURITY DEFINER para evitar conflicto entre trigger insert_audit_log y WITH CHECK de RLS
    const { error } = await supabase.rpc("soft_delete_session", { p_session_id: deleteSession.id });
    if (error) {
      console.error("Error al eliminar la sesión:", error);
      setDeleting(false);
      toast.error(`Error al eliminar la sesión: ${error.message}`);
      return;
    }

    // Si era alta, revertir episode si corresponde (el RPC ya revierte patients.status)
    if (wasDischarge && episodeId) {
      const { data: remaining } = await supabase
        .from("therapy_sessions")
        .select("id")
        .eq("patient_id", patientId)
        .eq("session_type", "discharge")
        .eq("is_deleted", false)
        .limit(1);
      if (!remaining || remaining.length === 0) {
        await supabase
          .from("treatment_episodes")
          .update({ status: "active", discharge_date: null })
          .eq("id", episodeId);
      }
    }

    setDeleting(false);
    toast.success("Sesión eliminada correctamente");
    setDeleteSession(null);
    onDeleted();
  };

  return (
    <>
    <div className="space-y-3">
      {sessions.map((s) => {
        const isOpen = expanded === s.id;
        const linkedEval = analEvals.find(e => matchesSessionEval(s, e));
        const linkedFuncEval = funcEvals.find(e => matchesSessionEval(s, e));

        return (
          <div key={s.id} className="bg-card rounded-[10px] border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-[13px]">{format(new Date(s.session_date), "dd/MM/yyyy")}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {s.session_type && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${typeColor[s.session_type] || "border-border text-muted-foreground bg-transparent"}`}>{typeLabel[s.session_type] || s.session_type}</span>}
                  {s.session_number != null && <span className="text-[11px] text-muted-foreground">Sesión Nº {s.session_number}</span>}
                  {s.week_at_session != null && <span className="text-[11px] text-muted-foreground">· Semana {s.week_at_session} POP/PL</span>}
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/patients/${patientId}/sessions/${s.id}/edit`)} aria-label="Editar sesión">
                  <Edit className="h-4 w-4" />
                </Button>
                {s.session_type !== "admission" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteSession(s)} aria-label="Eliminar sesión">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

              {/* Expanded clinical note */}
              {isOpen && (
                <div className="border-t border-border px-5 py-4 space-y-4 text-sm text-foreground">
                  {/* Header line */}
                  <p className="italic text-muted-foreground mb-3">
                    {s.session_number != null
                      ? `Paciente asiste a ${ordinal(s.session_number)} sesión`
                      : "Paciente asiste a sesión"}
                    {s.week_at_session != null && (
                      `, cursando su ${s.week_at_session} semana ${
                        s.session_type === "admission" ? "de admisión" :
                        s.session_type === "discharge" ? "de alta" : "POP/PL"
                      }`
                    )}
                    {s.week_at_session == null && s.session_type === "admission" && " de admisión"}
                    {s.week_at_session == null && s.session_type === "discharge" && " de alta"}
                    .
                  </p>

                  {/* EVOLUCIÓN */}
                  {(nn(s.general_observations) || nn(s.evolution) || nn(s.symptom_changes) || nn(s.clinical_changes) || nn(s.treatment_adjustments)) && (
                    <div className="space-y-2">
                      <SectionHeading>Evolución</SectionHeading>
                      {nn(s.general_observations) && <Line>{s.general_observations}</Line>}
                      {nn(s.evolution) && <Line>{s.evolution}</Line>}
                      {nn(s.symptom_changes) && <Line>Cambios en síntomas: {s.symptom_changes}</Line>}
                      {nn(s.clinical_changes) && <Line>Cambios clínicos: {s.clinical_changes}</Line>}
                      {nn(s.treatment_adjustments) && <Line>Ajustes al tratamiento: {s.treatment_adjustments}</Line>}
                    </div>
                  )}

                  {/* AVD EN SESIÓN */}
                  {nn(s.avd_followup) && (
                    <div className="space-y-2">
                      <SectionHeading>AVD en sesión</SectionHeading>
                      <Line>{s.avd_followup}</Line>
                    </div>
                  )}

                  {/* EN EL DÍA DE HOY SE ABORDÓ */}
                  {nn(s.interventions) && (
                    <div>
                      <SectionHeading>En el día de hoy se abordó</SectionHeading>
                      <Line>{s.interventions}</Line>
                    </div>
                  )}

                  {/* INDICACIONES ENVIADAS */}
                  {nn(s.home_instructions_sent) && (
                    <div>
                      <SectionHeading>Indicaciones enviadas</SectionHeading>
                      <Line>{s.home_instructions_sent}</Line>
                    </div>
                  )}

                  {/* NOTAS */}
                  {nn(s.notes) && (
                    <div>
                      <SectionHeading>Notas</SectionHeading>
                      <Line>{s.notes}</Line>
                    </div>
                  )}

                  {/* Closing date */}
                  <p className="text-right text-xs text-muted-foreground pt-2">
                    {format(new Date(s.session_date), "dd/MM/yyyy")}
                  </p>
                </div>
              )}

              {/* Evaluation buttons footer */}
              {(linkedEval || linkedFuncEval) && (
                <div className="border-t border-border/50 px-5 py-3 flex flex-wrap gap-2" onClick={(ev) => ev.stopPropagation()}>
                  {linkedEval && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => navigate(`/patients/${patientId}/evaluations/analytical/${linkedEval.id}`)}
                      aria-label={`Ver evaluación analítica — sesión ${s.session_number ?? ""}${s.session_date ? ` del ${format(new Date(s.session_date), "dd/MM/yyyy")}` : ""}`}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Ver evaluación analítica
                    </Button>
                  )}
                  {linkedFuncEval && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => navigate(`/patients/${patientId}/evaluations/functional/${linkedFuncEval.id}`)}
                      aria-label={`Ver evaluación funcional — sesión ${s.session_number ?? ""}${s.session_date ? ` del ${format(new Date(s.session_date), "dd/MM/yyyy")}` : ""}`}
                    >
                      <Activity className="h-3.5 w-3.5" />
                      Ver evaluación funcional
                    </Button>
                  )}
                </div>
              )}
            </div>
        );
      })}
    </div>
    <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar sesión</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción ocultará la sesión del historial. No se puede eliminar la sesión de admisión.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSession} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


function NewFuncEvalDialog({ open, onClose, patientId, userId, onSaved }: { open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    evaluation_date: new Date().toISOString().split("T")[0],
    barthel_score: "", dash_score: "",
    avd: "", aivd: "", work_education: "", leisure: "",
    physical_activity: "", sleep_rest: "", health_management: "",
    observations: "",
  });

  const resetForm = () => setForm({
    evaluation_date: new Date().toISOString().split("T")[0],
    barthel_score: "", dash_score: "",
    avd: "", aivd: "", work_education: "", leisure: "",
    physical_activity: "", sleep_rest: "", health_management: "",
    observations: "",
  });

  const buildNotes = () => {
    const parts: string[] = [];
    if (form.work_education.trim()) parts.push(`Trabajo/Educación: ${form.work_education.trim()}`);
    if (form.leisure.trim()) parts.push(`Ocio: ${form.leisure.trim()}`);
    if (form.observations.trim()) parts.push(`Observaciones: ${form.observations.trim()}`);
    return parts.length > 0 ? parts.join("\n\n") : null;
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("functional_evaluations").insert({
      patient_id: patientId, professional_id: userId,
      evaluation_date: form.evaluation_date,
      
      barthel_score: form.barthel_score ? parseInt(form.barthel_score) : null,
      dash_score: form.dash_score ? parseInt(form.dash_score) : null,
      avd: form.avd || null, aivd: form.aivd || null,
      physical_activity: form.physical_activity || null,
      sleep_rest: form.sleep_rest || null,
      health_management: form.health_management || null,
      notes: buildNotes(),
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar la evaluación funcional"); return; }
    toast.success("Evaluación funcional registrada correctamente");
    resetForm();
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Evaluación Funcional</DialogTitle>
          <DialogDescription className="sr-only">Formulario de evaluación funcional</DialogDescription>
        </DialogHeader>
        <Accordion type="multiple" defaultValue={["general", "occupational", "health", "notes"]} className="w-full">
          {/* Section 1 */}
          <AccordionItem value="general">
            <AccordionTrigger className="text-sm font-semibold">Datos Generales</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Fecha de evaluación *</Label>
                <Input type="date" value={form.evaluation_date} onChange={(e) => setForm({ ...form, evaluation_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Puntaje Barthel (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.barthel_score} onChange={(e) => setForm({ ...form, barthel_score: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Puntaje DASH (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.dash_score} onChange={(e) => setForm({ ...form, dash_score: e.target.value })} />
                <p className="text-xs text-muted-foreground">0 = sin discapacidad, 100 = máxima discapacidad</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2 */}
          <AccordionItem value="occupational">
            <AccordionTrigger className="text-sm font-semibold">Desempeño Ocupacional</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>AVD — Actividades de la vida diaria</Label>
                <Textarea value={form.avd} onChange={(e) => setForm({ ...form, avd: e.target.value })} rows={3} placeholder="Higiene, alimentación, vestido, traslados..." />
              </div>
              <div className="space-y-2">
                <Label>AIVD — Actividades instrumentales</Label>
                <Textarea value={form.aivd} onChange={(e) => setForm({ ...form, aivd: e.target.value })} rows={3} placeholder="Preparación de comidas, manejo de dinero, uso del teléfono, compras..." />
              </div>
              <div className="space-y-2">
                <Label>Trabajo / Educación</Label>
                <Textarea value={form.work_education} onChange={(e) => setForm({ ...form, work_education: e.target.value })} rows={3} placeholder="Situación laboral/educativa actual, limitaciones, objetivos..." />
              </div>
              <div className="space-y-2">
                <Label>Ocio y tiempo libre</Label>
                <Textarea value={form.leisure} onChange={(e) => setForm({ ...form, leisure: e.target.value })} rows={2} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3 */}
          <AccordionItem value="health">
            <AccordionTrigger className="text-sm font-semibold">Hábitos de Salud</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Actividad física</Label>
                <Textarea value={form.physical_activity} onChange={(e) => setForm({ ...form, physical_activity: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Descanso y sueño</Label>
                <Textarea value={form.sleep_rest} onChange={(e) => setForm({ ...form, sleep_rest: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Gestión de la salud</Label>
                <Textarea value={form.health_management} onChange={(e) => setForm({ ...form, health_management: e.target.value })} rows={2} placeholder="Adherencia a turnos médicos, automedicación, hábitos preventivos..." />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4 */}
          <AccordionItem value="notes">
            <AccordionTrigger className="text-sm font-semibold">Notas de Evaluación</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Observaciones adicionales</Label>
                <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.evaluation_date}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FuncEvalList({ evaluations, patientId }: { evaluations: any[]; patientId: string }) {
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

// NewAnalEvalDialog moved to src/components/evaluations/AnalyticalEvalForm.tsx

function NewPatientApptDialog({ open, onClose, patientId, userId, onSaved }: { open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    appointment_date: "",
    type: "consultation" as "consultation" | "follow_up" | "evaluation",
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
    notes: "",
  });

  const handleSave = async () => {
    if (!form.appointment_date) { toast.error("Ingresá fecha y hora"); return; }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId, professional_id: userId,
      appointment_date: new Date(form.appointment_date).toISOString(),
      type: form.type, status: form.status, notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear turno"); return; }
    toast.success("Turno creado");
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo Turno</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Fecha y hora *</Label><Input type="datetime-local" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="follow_up">Seguimiento</SelectItem>
                <SelectItem value="evaluation">Evaluación</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SelectedExercise {
  id: string;
  name: string;
  body_region: string | null;
  repetitions: number | null;
  sets: number | null;
  frequency: string;
  duration: string;
  notes: string;
}

function NewPlanDialog({ open, onClose, patientId, userId, onSaved }: { open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "", objective: "", indications: "", skin_care: "",
    joint_protection_guidelines: "", home_item_recommendations: "",
    start_date: new Date().toISOString().split("T")[0], end_date: "", notes: "",
  });
  const [exercises, setExercises] = useState<any[]>([]);
  const [searchEx, setSearchEx] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);

  useEffect(() => {
    if (step === 2 && exercises.length === 0) {
      setLoadingEx(true);
      supabase.from("exercise_library")
        .select("id, name, body_region, default_repetitions, default_sets, default_frequency, default_duration")
        .eq("is_active", true)
        .then(({ data }) => { setExercises(data || []); setLoadingEx(false); });
    }
  }, [step]);

  const resetAndClose = () => {
    setStep(1);
    setForm({ title: "", objective: "", indications: "", skin_care: "", joint_protection_guidelines: "", home_item_recommendations: "", start_date: new Date().toISOString().split("T")[0], end_date: "", notes: "" });
    setSelectedExercises([]);
    setSearchEx("");
    onClose();
  };

  const toggleExercise = (ex: any) => {
    const exists = selectedExercises.find(s => s.id === ex.id);
    if (exists) {
      setSelectedExercises(selectedExercises.filter(s => s.id !== ex.id));
    } else {
      setSelectedExercises([...selectedExercises, {
        id: ex.id, name: ex.name, body_region: ex.body_region,
        repetitions: ex.default_repetitions, sets: ex.default_sets,
        frequency: ex.default_frequency || "", duration: ex.default_duration || "", notes: "",
      }]);
    }
  };

  const updateSelected = (id: string, field: string, value: any) => {
    setSelectedExercises(selectedExercises.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: plan, error } = await supabase.from("treatment_plans").insert({
      patient_id: patientId, professional_id: userId,
      title: form.title, objective: form.objective || null,
      indications: form.indications || null, skin_care: form.skin_care || null,
      joint_protection_guidelines: form.joint_protection_guidelines || null,
      home_item_recommendations: form.home_item_recommendations || null,
      start_date: form.start_date, end_date: form.end_date || null,
      notes: form.notes || null, status: "active" as const,
    }).select().single();

    if (error || !plan) {
      setSaving(false);
      toast.error("Error al crear el plan de tratamiento");
      return;
    }

    if (selectedExercises.length > 0) {
      const { error: exError } = await supabase.from("treatment_plan_exercises").insert(
        selectedExercises.map((ex, i) => ({
          treatment_plan_id: plan.id, exercise_id: ex.id,
          repetitions: ex.repetitions, sets: ex.sets,
          frequency: ex.frequency || null, duration: ex.duration || null,
          notes: ex.notes || null, order_index: i,
        }))
      );
      if (exError) console.error("Error inserting exercises:", exError);
    }

    setSaving(false);
    toast.success("Plan de tratamiento creado correctamente");
    onSaved();
    resetAndClose();
  };

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(searchEx.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Plan de Tratamiento — Paso {step} de 2</DialogTitle>
          <DialogDescription className="sr-only">Formulario para crear un nuevo plan de tratamiento</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Plan de rehabilitación mano derecha" /></div>
            <div className="space-y-2"><Label>Objetivo terapéutico</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Indicaciones generales</Label><Textarea value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Cuidado de piel</Label><Textarea value={form.skin_care} onChange={(e) => setForm({ ...form, skin_care: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Pautas de protección articular</Label><Textarea value={form.joint_protection_guidelines} onChange={(e) => setForm({ ...form, joint_protection_guidelines: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Recomendaciones para el hogar</Label><Textarea value={form.home_item_recommendations} onChange={(e) => setForm({ ...form, home_item_recommendations: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha fin (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!form.title.trim()}>Siguiente →</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar ejercicio..." value={searchEx} onChange={(e) => setSearchEx(e.target.value)} />
            </div>

            {loadingEx ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredExercises.map((ex) => {
                  const selected = selectedExercises.find(s => s.id === ex.id);
                  return (
                    <div key={ex.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={!!selected} onCheckedChange={() => toggleExercise(ex)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ex.name}</p>
                          {ex.body_region && <p className="text-xs text-muted-foreground">{ex.body_region}</p>}
                        </div>
                      </div>
                      {selected && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
                          <div className="space-y-1">
                            <Label className="text-xs">Repeticiones</Label>
                            <Input type="number" className="h-8 text-xs" value={selected.repetitions ?? ""} onChange={(e) => updateSelected(ex.id, "repetitions", e.target.value ? parseInt(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Series</Label>
                            <Input type="number" className="h-8 text-xs" value={selected.sets ?? ""} onChange={(e) => updateSelected(ex.id, "sets", e.target.value ? parseInt(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Frecuencia</Label>
                            <Input className="h-8 text-xs" value={selected.frequency} onChange={(e) => updateSelected(ex.id, "frequency", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Duración</Label>
                            <Input className="h-8 text-xs" value={selected.duration} onChange={(e) => updateSelected(ex.id, "duration", e.target.value)} />
                          </div>
                          <div className="col-span-2 sm:col-span-4 space-y-1">
                            <Label className="text-xs">Notas</Label>
                            <Input className="h-8 text-xs" value={selected.notes} onChange={(e) => updateSelected(ex.id, "notes", e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredExercises.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ejercicios.</p>}
              </div>
            )}

            {selectedExercises.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedExercises.length} ejercicio(s) seleccionado(s)</p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Plan"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanDetailDialog({ plan, onClose }: { plan: any; onClose: () => void }) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setLoading(true);
      supabase.from("treatment_plan_exercises")
        .select("*, exercise_library(name, body_region)")
        .eq("treatment_plan_id", plan.id)
        .order("order_index")
        .then(({ data }) => { setExercises(data || []); setLoading(false); });
    } else {
      setExercises([]);
    }
  }, [plan]);

  return (
    <Dialog open={!!plan} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.title}</DialogTitle>
          <DialogDescription className="sr-only">Detalle del plan de tratamiento</DialogDescription>
        </DialogHeader>
        {plan && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={plan.status} />
              <span className="text-sm text-muted-foreground">
                {format(new Date(plan.start_date), "dd/MM/yyyy")}
                {plan.end_date ? ` — ${format(new Date(plan.end_date), "dd/MM/yyyy")}` : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Objetivo", plan.objective],
                ["Indicaciones", plan.indications],
                ["Cuidado de piel", plan.skin_care],
                ["Protección articular", plan.joint_protection_guidelines],
                ["Recomendaciones hogar", plan.home_item_recommendations],
                ["Notas", plan.notes],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-muted-foreground text-xs font-medium">{label as string}</p>
                  <p className="text-foreground">{(value as string) || "—"}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Ejercicios asignados</h3>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ejercicios asignados.</p>
              ) : (
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <div key={ex.id} className="border rounded-lg p-3 text-sm">
                      <p className="font-medium">{ex.custom_name || ex.exercise_library?.name || "Ejercicio"}</p>
                      {ex.exercise_library?.body_region && <p className="text-xs text-muted-foreground">{ex.exercise_library.body_region}</p>}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {ex.repetitions && <span>Rep: {ex.repetitions}</span>}
                        {ex.sets && <span>Series: {ex.sets}</span>}
                        {ex.frequency && <span>Frec: {ex.frequency}</span>}
                        {ex.duration && <span>Dur: {ex.duration}</span>}
                      </div>
                      {ex.notes && <p className="text-xs text-muted-foreground mt-1">{ex.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({ plan, onClose, patientId, userId, onSaved }: { plan: any; onClose: () => void; patientId: string; userId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "", objective: "", indications: "", skin_care: "",
    joint_protection_guidelines: "", home_item_recommendations: "",
    start_date: "", end_date: "", notes: "", status: "active" as string,
  });
  const [exercises, setExercises] = useState<any[]>([]);
  const [searchEx, setSearchEx] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (plan && !initialized) {
      setForm({
        title: plan.title || "", objective: plan.objective || "",
        indications: plan.indications || "", skin_care: plan.skin_care || "",
        joint_protection_guidelines: plan.joint_protection_guidelines || "",
        home_item_recommendations: plan.home_item_recommendations || "",
        start_date: plan.start_date || "", end_date: plan.end_date || "",
        notes: plan.notes || "", status: plan.status || "active",
      });
      setStep(1);
      setInitialized(true);

      // Load existing exercises for this plan
      supabase.from("treatment_plan_exercises")
        .select("*, exercise_library(name, body_region)")
        .eq("treatment_plan_id", plan.id)
        .order("order_index")
        .then(({ data }) => {
          if (data) {
            setSelectedExercises(data.map((ex: any) => ({
              id: ex.exercise_id,
              name: ex.custom_name || ex.exercise_library?.name || "",
              body_region: ex.exercise_library?.body_region || null,
              repetitions: ex.repetitions, sets: ex.sets,
              frequency: ex.frequency || "", duration: ex.duration || "", notes: ex.notes || "",
            })));
          }
        });
    }
    if (!plan) { setInitialized(false); setSelectedExercises([]); setExercises([]); setSearchEx(""); }
  }, [plan, initialized]);

  useEffect(() => {
    if (plan && step === 2 && exercises.length === 0) {
      setLoadingEx(true);
      supabase.from("exercise_library")
        .select("id, name, body_region, default_repetitions, default_sets, default_frequency, default_duration")
        .eq("is_active", true)
        .then(({ data }) => { setExercises(data || []); setLoadingEx(false); });
    }
  }, [step, plan]);

  const resetAndClose = () => { setStep(1); setInitialized(false); onClose(); };

  const toggleExercise = (ex: any) => {
    const exists = selectedExercises.find(s => s.id === ex.id);
    if (exists) {
      setSelectedExercises(selectedExercises.filter(s => s.id !== ex.id));
    } else {
      setSelectedExercises([...selectedExercises, {
        id: ex.id, name: ex.name, body_region: ex.body_region,
        repetitions: ex.default_repetitions, sets: ex.default_sets,
        frequency: ex.default_frequency || "", duration: ex.default_duration || "", notes: "",
      }]);
    }
  };

  const updateSelected = (id: string, field: string, value: any) => {
    setSelectedExercises(selectedExercises.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("treatment_plans").update({
      title: form.title, objective: form.objective || null,
      indications: form.indications || null, skin_care: form.skin_care || null,
      joint_protection_guidelines: form.joint_protection_guidelines || null,
      home_item_recommendations: form.home_item_recommendations || null,
      start_date: form.start_date, end_date: form.end_date || null,
      notes: form.notes || null, status: form.status as any,
    }).eq("id", plan.id);

    if (error) { setSaving(false); toast.error("Error al actualizar el plan"); return; }

    // Replace exercises: delete old, insert new
    await supabase.from("treatment_plan_exercises").delete().eq("treatment_plan_id", plan.id);
    if (selectedExercises.length > 0) {
      await supabase.from("treatment_plan_exercises").insert(
        selectedExercises.map((ex, i) => ({
          treatment_plan_id: plan.id, exercise_id: ex.id,
          repetitions: ex.repetitions, sets: ex.sets,
          frequency: ex.frequency || null, duration: ex.duration || null,
          notes: ex.notes || null, order_index: i,
        }))
      );
    }

    setSaving(false);
    toast.success("Plan actualizado correctamente");
    onSaved();
    resetAndClose();
  };

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(searchEx.toLowerCase())
  );

  return (
    <Dialog open={!!plan} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Plan — Paso {step} de 2</DialogTitle>
          <DialogDescription className="sr-only">Formulario para editar plan de tratamiento</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Objetivo terapéutico</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Indicaciones generales</Label><Textarea value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Cuidado de piel</Label><Textarea value={form.skin_care} onChange={(e) => setForm({ ...form, skin_care: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Pautas de protección articular</Label><Textarea value={form.joint_protection_guidelines} onChange={(e) => setForm({ ...form, joint_protection_guidelines: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Recomendaciones para el hogar</Label><Textarea value={form.home_item_recommendations} onChange={(e) => setForm({ ...form, home_item_recommendations: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha fin (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!form.title.trim()}>Siguiente →</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar ejercicio..." value={searchEx} onChange={(e) => setSearchEx(e.target.value)} />
            </div>

            {loadingEx ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredExercises.map((ex) => {
                  const selected = selectedExercises.find(s => s.id === ex.id);
                  return (
                    <div key={ex.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={!!selected} onCheckedChange={() => toggleExercise(ex)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ex.name}</p>
                          {ex.body_region && <p className="text-xs text-muted-foreground">{ex.body_region}</p>}
                        </div>
                      </div>
                      {selected && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
                          <div className="space-y-1"><Label className="text-xs">Repeticiones</Label><Input type="number" className="h-8 text-xs" value={selected.repetitions ?? ""} onChange={(e) => updateSelected(ex.id, "repetitions", e.target.value ? parseInt(e.target.value) : null)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Series</Label><Input type="number" className="h-8 text-xs" value={selected.sets ?? ""} onChange={(e) => updateSelected(ex.id, "sets", e.target.value ? parseInt(e.target.value) : null)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Frecuencia</Label><Input className="h-8 text-xs" value={selected.frequency} onChange={(e) => updateSelected(ex.id, "frequency", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Duración</Label><Input className="h-8 text-xs" value={selected.duration} onChange={(e) => updateSelected(ex.id, "duration", e.target.value)} /></div>
                          <div className="col-span-2 sm:col-span-4 space-y-1"><Label className="text-xs">Notas</Label><Input className="h-8 text-xs" value={selected.notes} onChange={(e) => updateSelected(ex.id, "notes", e.target.value)} /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredExercises.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ejercicios.</p>}
              </div>
            )}

            {selectedExercises.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedExercises.length} ejercicio(s) seleccionado(s)</p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeletePlanConfirm({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("treatment_plans").update({ is_deleted: true }).eq("id", plan.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el plan"); return; }
    toast.success("Plan eliminado correctamente");
    onSaved();
    onClose();
  };

  return (
    <AlertDialog open={!!plan} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar plan de tratamiento?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará el plan "{plan?.title}". Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PlanCardActions({ plan, patient, onDetail, onEdit, onDelete }: { plan: any; patient: any; onDetail: () => void; onEdit: () => void; onDelete: () => void }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPlanPdf(plan, patient);
      toast.success("PDF exportado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
      <Button variant="default" size="sm" className="flex-1 min-w-0" onClick={onDetail}>
        <Eye className="h-4 w-4 mr-1 shrink-0" /> Detalle
      </Button>
      <Button variant="outline" size="sm" className="flex-1 min-w-0" onClick={onEdit}>
        <Edit className="h-4 w-4 mr-1 shrink-0" /> Editar
      </Button>
      <Button variant="outline" size="sm" className="flex-1 min-w-0" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-1 shrink-0" /> PDF</>}
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function UploadFileDialog({ open, onClose, patientId, userId, onSaved, episodeId }: { open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void; episodeId: string | null }) {
  const [category, setCategory] = useState<string>("");
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setCategory(""); setPhotoDate(new Date().toISOString().split("T")[0]); setDescription(""); setFile(null); setFileError(""); onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFileError("");
    if (!f) { setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setFileError("El archivo supera los 50MB permitidos."); setFile(null); return; }
    if (!isAllowedClinicalFileType(f.type)) {
      setFileError("Formato no permitido. Usá JPG, PNG, WebP, GIF, PDF, MP4 o MOV.");
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const handleSave = async () => {
    if (!category || !file) return;
    if (!isAllowedClinicalFileType(file.type)) {
      toast.error("Formato de archivo no permitido");
      return;
    }
    setSaving(true);
    const path = `${userId}/${patientId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("clinical-files").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error("Error al subir el archivo"); setSaving(false); return; }
    const { error } = await supabase.from("clinical_files").insert({
      patient_id: patientId, uploaded_by: userId, file_name: file.name,
      file_path: path, file_type: file.type, category: category as any,
      description: description || null, photo_date: photoDate, is_deleted: false,
      episode_id: episodeId ?? null,
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar el archivo"); return; }
    toast.success("Archivo guardado correctamente");
    resetAndClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar archivo</DialogTitle>
          <DialogDescription>Subí fotos de evolución, estudios o documentos del paciente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Foto de evolución</SelectItem>
                <SelectItem value="study">Estudio (Rx, RMN, eco...)</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Podés cambiar la fecha si la foto es de otro día</p>
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Semana 3 post-cirugía, dorso de mano..." />
          </div>
          <div className="space-y-2">
            <Label>Archivo *</Label>
            <Input type="file" accept={CLINICAL_FILE_ACCEPT} onChange={handleFileChange} />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !category || !file}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Subir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFileConfirm({ file, onClose, onDeleted }: { file: any; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("clinical_files").update({ is_deleted: true }).eq("id", file.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el archivo"); return; }
    toast.success("Archivo eliminado");
    onDeleted(file.id);
    onClose();
  };

  return (
    <AlertDialog open={!!file} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará "{file?.file_name}". Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Cie10AutocompleteInline({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ code: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_cie10', {
        search_input: term,
        max_results: 10
      });
      if (cancelled) return;
      setResults(data || []);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div ref={wrapper} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => { onChange(`${r.code} — ${r.description}`); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{r.code}</span> — {r.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewEpisodeDialog({ open, onClose, patientId, userId, episodes, onSaved }: {
  open: boolean; onClose: () => void; patientId: string; userId: string; episodes: any[]; onSaved: (newEpId: string) => void;
}) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    admission_date: new Date().toISOString().split("T")[0],
    diagnosis: "",
    treatment_type: "",
    doctor_name: "",
    injury_mechanism: "",
    weeks_post_injury: "",
  });

  const resetForm = () => setForm({
    admission_date: new Date().toISOString().split("T")[0],
    diagnosis: "", treatment_type: "", doctor_name: "", injury_mechanism: "", weeks_post_injury: "",
  });

  const handleSave = async () => {
    if (!form.diagnosis.trim()) return;
    setSaving(true);
    try {
      const maxEpNum = Math.max(...episodes.map((e: any) => e.episode_number), 0);

      // 1. Insert new episode
      const { data: newEp, error: epErr } = await supabase
        .from("treatment_episodes")
        .insert({
          patient_id: patientId,
          professional_id: userId,
          episode_number: maxEpNum + 1,
          admission_date: form.admission_date,
          status: "active",
          diagnosis: form.diagnosis.trim(),
        })
        .select("id")
        .single();

      if (epErr || !newEp) throw epErr || new Error("Failed to create episode");

      // 2. Insert clinical record for this episode
      await supabase.from("patient_clinical_records").insert({
        patient_id: patientId,
        episode_id: newEp.id,
        diagnosis: form.diagnosis.trim(),
        treatment_type: form.treatment_type || null,
        doctor_name: form.doctor_name || null,
        injury_mechanism: form.injury_mechanism || null,
        weeks_post_injury: form.weeks_post_injury ? parseInt(form.weeks_post_injury) : null,
      });

      // 3. Set previous active episodes to discharged
      const activeEps = episodes.filter((e: any) => e.status === "active");
      for (const ep of activeEps) {
        await supabase.from("treatment_episodes").update({ status: "discharged", discharge_date: form.admission_date }).eq("id", ep.id);
      }

      toast.success("Nuevo episodio creado correctamente");
      onSaved(newEp.id);
      navigate(`/patients/${patientId}/sessions/new?episode=${newEp.id}&type=admission`);
    } catch (err: any) {
      toast.error("Error al crear el episodio", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Episodio de Tratamiento</DialogTitle>
          <DialogDescription className="sr-only">Crear un nuevo episodio de tratamiento</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha de admisión *</Label>
            <Input type="date" value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Diagnóstico *</Label>
            <Cie10AutocompleteInline value={form.diagnosis} onChange={(v) => setForm({ ...form, diagnosis: v })} placeholder="Buscar por código o descripción CIE-10…" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de tratamiento</Label>
            <Select value={form.treatment_type} onValueChange={v => setForm({ ...form, treatment_type: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservador</SelectItem>
                <SelectItem value="surgery">Quirúrgico</SelectItem>
                <SelectItem value="mixed">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Médico derivante</Label>
            <Input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Mecanismo de lesión</Label>
            <Input value={form.injury_mechanism} onChange={e => setForm({ ...form, injury_mechanism: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Semanas post lesión</Label>
            <Input type="number" min={0} value={form.weeks_post_injury} onChange={e => setForm({ ...form, weeks_post_injury: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.diagnosis.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear episodio"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
