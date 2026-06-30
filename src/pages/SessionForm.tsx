import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { differenceInYears, differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { emptyFim, emptyBarthel, calcFimTotal, calcBarthelTotal } from "@/components/evaluations/FunctionalScales";
import { buildCircometriaPayload, normalizeCircometriaValue, isCircometriaFormat, type CircometriaItem } from "@/components/clinical/EdemaCircometryTable";
import { STEPS_ADMISSION, STEPS_SESSION, GONIO_PARTS, emptyPain, parseDyn } from "@/components/session/constants";
import { numFieldErr } from "@/components/session/shared";
import type { GonioPartKey, GonioBySide, PainEntry, PainTipo, TestResult } from "@/components/session/types";
import { SPECIFIC_TESTS } from "@/components/session/constants";
import { DatosStep } from "@/components/session/steps/DatosStep";
import { FichaClinicaStep } from "@/components/session/steps/FichaClinicaStep";
import { PerfilOcupacionalStep } from "@/components/session/steps/PerfilOcupacionalStep";
import { FuncionalStep } from "@/components/session/steps/FuncionalStep";
import { EvolucionStep } from "@/components/session/steps/EvolucionStep";
import { AnaliticaStep } from "@/components/session/steps/AnaliticaStep";
import { CierreStep } from "@/components/session/steps/CierreStep";

const emptySide = () => ({ shoulder: {}, elbow: {}, wrist: {}, hand: {}, thumb: {} } as Record<GonioPartKey, Record<string, string>>);
const emptyGonio = (): GonioBySide => ({ MSD: emptySide(), MSI: emptySide() });

export default function SessionForm() {
  const { patientId, sessionId } = useParams<{ patientId: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const episodeIdParam = searchParams.get("episode");
  const typeParam = searchParams.get("type");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditMode = !!sessionId;

  const [patient, setPatient] = useState<any>(null);
  const [clinical, setClinical] = useState<any>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(episodeIdParam);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingFuncEval, setEditingFuncEval] = useState<any>(null);
  const [editingAnalEval, setEditingAnalEval] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Session basics
  const [session_date, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [session_type, setSessionType] = useState(typeParam === "admission" ? "admission" : "follow_up");
  const [session_number, setSessionNumber] = useState("");
  const [week_at_session, setWeekAtSession] = useState("");
  const [general_observations, setGeneralObservations] = useState("");
  const [symptom_changes, setSymptomChanges] = useState("");
  const [clinical_changes, setClinicalChanges] = useState("");
  const [discharge_summary, setDischargeSummary] = useState("");
  const [avd_followup, setAvdFollowup] = useState("");

  // Functional eval
  const [func_dominance, setFuncDominance] = useState("");
  const [func_avd, setFuncAvd] = useState("");
  const [func_aivd, setFuncAivd] = useState("");
  const [func_sleep, setFuncSleep] = useState("");
  const [func_health, setFuncHealth] = useState("");
  const [fim_items, setFimItems] = useState<Record<string, number | null>>(emptyFim());
  const [barthel_items, setBarthelItems] = useState<Record<string, number | null>>(emptyBarthel());

  const isAdmission = session_type === "admission";

  // Ficha clínica
  const [cli_diagnosis, setCliDiagnosis] = useState("");
  const [cli_doctor_name, setCliDoctorName] = useState("");
  const [cli_injury_date, setCliInjuryDate] = useState("");
  const [cli_surgery_date, setCliSurgeryDate] = useState("");
  const [cli_injury_mechanism, setCliInjuryMechanism] = useState("");
  const [cli_treatment_type, setCliTreatmentType] = useState("");
  const [cli_immob_weeks, setCliImmobWeeks] = useState("");
  const [cli_immob_days, setCliImmobDays] = useState("");
  const [cli_immob_type, setCliImmobType] = useState("");
  const [cli_medical_history, setCliMedicalHistory] = useState("");
  const [cli_pharma, setCliPharma] = useState("");
  const [cli_studies, setCliStudies] = useState("");
  const [editingClinicalId, setEditingClinicalId] = useState<string | null>(null);

  // Perfil ocupacional
  const [occ_dominance, setOccDominance] = useState("");
  const [occ_support_network, setOccSupportNetwork] = useState("");
  const [occ_education, setOccEducation] = useState("");
  const [occ_job, setOccJob] = useState("");
  const [occ_leisure, setOccLeisure] = useState("");
  const [occ_physical_activity, setOccPhysicalActivity] = useState("");
  const [occ_sleep_rest, setOccSleepRest] = useState("");
  const [occ_health_management, setOccHealthManagement] = useState("");
  const [editingOccId, setEditingOccId] = useState<string | null>(null);

  const [referral_date, setReferralDate] = useState("");
  const [showFunctional, setShowFunctional] = useState(true);
  const [show_measurements, setShowMeasurements] = useState(true);

  // Analytical subsection toggles
  const [showPain, setShowPain] = useState(true);
  const [showEdema, setShowEdema] = useState(true);
  const [showMobility, setShowMobility] = useState(true);
  const [showStrength, setShowStrength] = useState(true);
  const [affected_side, setAffectedSide] = useState<"MSD" | "MSI" | "both" | null>(null);
  const [showSensitivity, setShowSensitivity] = useState(true);
  const [showCicatriz, setShowCicatriz] = useState(true);
  const [showSpecificTests, setShowSpecificTests] = useState(true);
  const [showOtros, setShowOtros] = useState(true);

  // Pain
  const [pains, setPains] = useState<PainEntry[]>([emptyPain(1)]);
  const painsNextId = useRef(2);

  // Edema
  const [edema_obs, setEdemaObs] = useState("");
  const [godet_test, setGodetTest] = useState("");
  const [mobility_observations, setMobilityObservations] = useState("");
  const [edema_circ_items, setEdemaCircItems] = useState<CircometriaItem[]>([]);

  // Goniometry data (pre/post, AROM/PROM, by side)
  const [all_pre_gonio, setAllPreGonio] = useState<GonioBySide>(emptyGonio);
  const [show_arom, setShowArom] = useState(true);
  const [show_arom_post, setShowAromPost] = useState(false);
  const [all_arom_post_gonio, setAllAromPostGonio] = useState<GonioBySide>(emptyGonio);
  const [show_prom, setShowProm] = useState(false);
  const [all_prom_pre_gonio, setAllPromPreGonio] = useState<GonioBySide>(emptyGonio);
  const [show_prom_post, setShowPromPost] = useState(false);
  const [all_post_gonio, setAllPostGonio] = useState<GonioBySide>(emptyGonio);

  // Strength
  const [fist_closure, setFistClosure] = useState("");
  const [dyn_msd_vals, setDynMsdVals] = useState<[string, string, string]>(["", "", ""]);
  const [dyn_msi_vals, setDynMsiVals] = useState<[string, string, string]>(["", "", ""]);
  const [kapandji_val, setKapandjiVal] = useState("");
  const [kapandji_pain, setKapandjiPain] = useState(false);
  const [dppd_pulgar, setDppdPulgar] = useState("");
  const [dppd_indice, setDppdIndice] = useState("");
  const [dppd_medio, setDppdMedio] = useState("");
  const [dppd_anular, setDppdAnular] = useState("");
  const [dppd_menique, setDppdMenique] = useState("");
  const [danielsRows, setDanielsRows] = useState<{ id: number; muscle: string; grade: string }[]>([{ id: 1, muscle: "", grade: "" }]);
  const danielsNextId = useRef(2);

  // Specific tests
  const [specificTests, setSpecificTests] = useState<Record<string, TestResult>>(
    Object.fromEntries(SPECIFIC_TESTS.map((t) => [t.key, null]))
  );

  // Sensitivity
  const [sensitivity, setSensitivity] = useState("");
  const [sensitivity_tacto_ligero, setSensitivityTactoLigero] = useState("");
  const [sensitivity_dos_puntos, setSensitivityDosPuntos] = useState("");
  const [sensitivity_picking_up, setSensitivityPickingUp] = useState("");
  const [sensitivity_semmes_weinstein, setSensitivitySemmesWeinstein] = useState("");
  const [sensitivity_toco_pincho, setSensitivityTocoPincho] = useState("");
  const [sensitivity_temperatura, setSensitivityTemperatura] = useState("");

  // Cicatriz & otros
  const [trophic_state, setTrophicState] = useState("");
  const [scar_localizacion, setScarLocalizacion] = useState("");
  const [scar_longitud, setScarLongitud] = useState("");
  const [scar_vascularizacion, setScarVascularizacion] = useState("");
  const [scar_pigmentacion, setScarPigmentacion] = useState("");
  const [scar_flexibilidad, setScarFlexibilidad] = useState("");
  const [scar_sensibilidad, setScarSensibilidad] = useState("");
  const [scar_relieve, setScarRelieve] = useState("");
  const [scar_temperatura, setScarTemperatura] = useState("");
  const [scar_observaciones, setScarObservaciones] = useState("");
  const [vss_pigmentacion, setVssPigmentacion] = useState("");
  const [vss_vascularizacion, setVssVascularizacion] = useState("");
  const [vss_flexibilidad, setVssFlexibilidad] = useState("");
  const [vss_altura, setVssAltura] = useState("");
  const [posture, setPosture] = useState("");
  const [emotional_state, setEmotionalState] = useState("");

  // Cierre
  const [interventions, setInterventions] = useState("");
  const [home_instructions_sent, setHomeInstructionsSent] = useState("");
  const [notes, setNotes] = useState("");

  // ── Draft persistence ────────────────────────────────────────────────────────
  const draftKey = `sf-draft-${patientId}-${sessionId ?? "new"}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef<Record<string, any>>({});
  latestStateRef.current = {
    session_date, session_type, session_number, week_at_session,
    general_observations, symptom_changes, clinical_changes, discharge_summary, avd_followup,
    func_dominance, func_avd, func_aivd, func_sleep, func_health, fim_items, barthel_items,
    cli_diagnosis, cli_doctor_name, cli_injury_date, cli_surgery_date, cli_injury_mechanism,
    cli_treatment_type, cli_immob_weeks, cli_immob_days, cli_immob_type, cli_medical_history, cli_pharma, cli_studies,
    occ_dominance, occ_support_network, occ_education, occ_job, occ_leisure, occ_physical_activity, occ_sleep_rest, occ_health_management,
    showFunctional, show_measurements,
    showPain, showEdema, showMobility, showStrength, affected_side, showSensitivity, showCicatriz, showSpecificTests, showOtros,
    pains, referral_date,
    edema_obs, godet_test, edema_circ_items,
    mobility_observations,
    all_pre_gonio, show_arom, show_arom_post, all_arom_post_gonio,
    show_prom, all_prom_pre_gonio, show_prom_post, all_post_gonio,
    fist_closure, dyn_msd_vals, dyn_msi_vals, kapandji_val, kapandji_pain,
    dppd_pulgar, dppd_indice, dppd_medio, dppd_anular, dppd_menique, danielsRows,
    specificTests,
    sensitivity, sensitivity_tacto_ligero, sensitivity_dos_puntos, sensitivity_picking_up,
    sensitivity_semmes_weinstein, sensitivity_toco_pincho, sensitivity_temperatura,
    trophic_state, scar_localizacion, scar_longitud, scar_vascularizacion, scar_pigmentacion,
    scar_flexibilidad, scar_sensibilidad, scar_relieve, scar_temperatura, scar_observaciones,
    vss_pigmentacion, vss_vascularizacion, vss_flexibilidad, vss_altura,
    posture, emotional_state,
    interventions, home_instructions_sent, notes,
    currentStep,
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftRestored) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      sessionStorage.setItem(draftKey, JSON.stringify(latestStateRef.current));
    }, 800);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  });

  const clearDraft = () => sessionStorage.removeItem(draftKey);

  useEffect(() => {
    if (loading || !secondaryLoaded || draftRestored) return;
    const raw = sessionStorage.getItem(draftKey);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.session_date !== undefined) setSessionDate(d.session_date);
        if (d.session_type !== undefined) setSessionType(d.session_type);
        if (d.session_number !== undefined) setSessionNumber(d.session_number);
        if (d.week_at_session !== undefined) setWeekAtSession(d.week_at_session);
        if (d.general_observations !== undefined) setGeneralObservations(d.general_observations);
        if (d.symptom_changes !== undefined) setSymptomChanges(d.symptom_changes);
        if (d.clinical_changes !== undefined) setClinicalChanges(d.clinical_changes);
        if (d.discharge_summary !== undefined) setDischargeSummary(d.discharge_summary);
        if (d.avd_followup !== undefined) setAvdFollowup(d.avd_followup);
        if (d.func_dominance !== undefined) setFuncDominance(d.func_dominance);
        if (d.func_avd !== undefined) setFuncAvd(d.func_avd);
        if (d.func_aivd !== undefined) setFuncAivd(d.func_aivd);
        if (d.func_sleep !== undefined) setFuncSleep(d.func_sleep);
        if (d.func_health !== undefined) setFuncHealth(d.func_health);
        if (d.fim_items !== undefined) setFimItems(d.fim_items);
        if (d.barthel_items !== undefined) setBarthelItems(d.barthel_items);
        if (d.cli_diagnosis !== undefined) setCliDiagnosis(d.cli_diagnosis);
        if (d.cli_doctor_name !== undefined) setCliDoctorName(d.cli_doctor_name);
        if (d.cli_injury_date !== undefined) setCliInjuryDate(d.cli_injury_date);
        if (d.cli_surgery_date !== undefined) setCliSurgeryDate(d.cli_surgery_date);
        if (d.cli_injury_mechanism !== undefined) setCliInjuryMechanism(d.cli_injury_mechanism);
        if (d.cli_treatment_type !== undefined) setCliTreatmentType(d.cli_treatment_type);
        if (d.cli_immob_weeks !== undefined) setCliImmobWeeks(d.cli_immob_weeks);
        if (d.cli_immob_days !== undefined) setCliImmobDays(d.cli_immob_days);
        if (d.cli_immob_type !== undefined) setCliImmobType(d.cli_immob_type);
        if (d.cli_medical_history !== undefined) setCliMedicalHistory(d.cli_medical_history);
        if (d.cli_pharma !== undefined) setCliPharma(d.cli_pharma);
        if (d.cli_studies !== undefined) setCliStudies(d.cli_studies);
        if (d.occ_dominance !== undefined) setOccDominance(d.occ_dominance);
        if (d.occ_support_network !== undefined) setOccSupportNetwork(d.occ_support_network);
        if (d.occ_education !== undefined) setOccEducation(d.occ_education);
        if (d.occ_job !== undefined) setOccJob(d.occ_job);
        if (d.occ_leisure !== undefined) setOccLeisure(d.occ_leisure);
        if (d.occ_physical_activity !== undefined) setOccPhysicalActivity(d.occ_physical_activity);
        if (d.occ_sleep_rest !== undefined) setOccSleepRest(d.occ_sleep_rest);
        if (d.occ_health_management !== undefined) setOccHealthManagement(d.occ_health_management);
        if (d.showFunctional !== undefined) setShowFunctional(d.showFunctional);
        if (d.show_measurements !== undefined) setShowMeasurements(d.show_measurements);
        if (d.showPain !== undefined) setShowPain(d.showPain);
        if (d.showEdema !== undefined) setShowEdema(d.showEdema);
        if (d.showMobility !== undefined) setShowMobility(d.showMobility);
        if (d.showStrength !== undefined) setShowStrength(d.showStrength);
        if (d.affected_side !== undefined) setAffectedSide(d.affected_side);
        if (d.showSensitivity !== undefined) setShowSensitivity(d.showSensitivity);
        if (d.showCicatriz !== undefined) setShowCicatriz(d.showCicatriz);
        if (d.showSpecificTests !== undefined) setShowSpecificTests(d.showSpecificTests);
        if (d.showOtros !== undefined) setShowOtros(d.showOtros);
        if (d.pains !== undefined && Array.isArray(d.pains)) { setPains(d.pains); painsNextId.current = d.pains.reduce((m: number, p: PainEntry) => Math.max(m, p.id + 1), 2); }
        if (d.referral_date !== undefined) setReferralDate(d.referral_date);
        if (d.mobility_observations !== undefined) setMobilityObservations(d.mobility_observations);
        if (d.edema_obs !== undefined) setEdemaObs(d.edema_obs);
        if (d.godet_test !== undefined) setGodetTest(d.godet_test);
        if (d.edema_circ_items !== undefined) setEdemaCircItems(d.edema_circ_items);
        if (d.all_pre_gonio !== undefined) setAllPreGonio(d.all_pre_gonio);
        if (d.show_arom !== undefined) setShowArom(d.show_arom);
        if (d.show_arom_post !== undefined) setShowAromPost(d.show_arom_post);
        if (d.all_arom_post_gonio !== undefined) setAllAromPostGonio(d.all_arom_post_gonio);
        if (d.show_prom !== undefined) setShowProm(d.show_prom);
        if (d.all_prom_pre_gonio !== undefined) setAllPromPreGonio(d.all_prom_pre_gonio);
        if (d.show_prom_post !== undefined) setShowPromPost(d.show_prom_post);
        if (d.all_post_gonio !== undefined) setAllPostGonio(d.all_post_gonio);
        if (d.fist_closure !== undefined) setFistClosure(d.fist_closure);
        if (d.dyn_msd_vals !== undefined) setDynMsdVals(d.dyn_msd_vals);
        if (d.dyn_msi_vals !== undefined) setDynMsiVals(d.dyn_msi_vals);
        if (d.kapandji_val !== undefined) setKapandjiVal(d.kapandji_val);
        if (d.kapandji_pain !== undefined) setKapandjiPain(d.kapandji_pain);
        if (d.dppd_pulgar !== undefined) setDppdPulgar(d.dppd_pulgar);
        if (d.dppd_indice !== undefined) setDppdIndice(d.dppd_indice);
        if (d.dppd_medio !== undefined) setDppdMedio(d.dppd_medio);
        if (d.dppd_anular !== undefined) setDppdAnular(d.dppd_anular);
        if (d.dppd_menique !== undefined) setDppdMenique(d.dppd_menique);
        if (d.danielsRows !== undefined) setDanielsRows(d.danielsRows);
        if (d.specificTests !== undefined) setSpecificTests(d.specificTests);
        if (d.sensitivity !== undefined) setSensitivity(d.sensitivity);
        if (d.sensitivity_tacto_ligero !== undefined) setSensitivityTactoLigero(d.sensitivity_tacto_ligero);
        if (d.sensitivity_dos_puntos !== undefined) setSensitivityDosPuntos(d.sensitivity_dos_puntos);
        if (d.sensitivity_picking_up !== undefined) setSensitivityPickingUp(d.sensitivity_picking_up);
        if (d.sensitivity_semmes_weinstein !== undefined) setSensitivitySemmesWeinstein(d.sensitivity_semmes_weinstein);
        if (d.sensitivity_toco_pincho !== undefined) setSensitivityTocoPincho(d.sensitivity_toco_pincho);
        if (d.sensitivity_temperatura !== undefined) setSensitivityTemperatura(d.sensitivity_temperatura);
        if (d.trophic_state !== undefined) setTrophicState(d.trophic_state);
        if (d.scar_localizacion !== undefined) setScarLocalizacion(d.scar_localizacion);
        if (d.scar_longitud !== undefined) setScarLongitud(d.scar_longitud);
        if (d.scar_vascularizacion !== undefined) setScarVascularizacion(d.scar_vascularizacion);
        if (d.scar_pigmentacion !== undefined) setScarPigmentacion(d.scar_pigmentacion);
        if (d.scar_flexibilidad !== undefined) setScarFlexibilidad(d.scar_flexibilidad);
        if (d.scar_sensibilidad !== undefined) setScarSensibilidad(d.scar_sensibilidad);
        if (d.scar_relieve !== undefined) setScarRelieve(d.scar_relieve);
        if (d.scar_temperatura !== undefined) setScarTemperatura(d.scar_temperatura);
        if (d.scar_observaciones !== undefined) setScarObservaciones(d.scar_observaciones);
        if (d.vss_pigmentacion !== undefined) setVssPigmentacion(d.vss_pigmentacion);
        if (d.vss_vascularizacion !== undefined) setVssVascularizacion(d.vss_vascularizacion);
        if (d.vss_flexibilidad !== undefined) setVssFlexibilidad(d.vss_flexibilidad);
        if (d.vss_altura !== undefined) setVssAltura(d.vss_altura);
        if (d.posture !== undefined) setPosture(d.posture);
        if (d.emotional_state !== undefined) setEmotionalState(d.emotional_state);
        if (d.interventions !== undefined) setInterventions(d.interventions);
        if (d.home_instructions_sent !== undefined) setHomeInstructionsSent(d.home_instructions_sent);
        if (d.notes !== undefined) setNotes(d.notes);
        if (d.currentStep !== undefined) setCurrentStep(d.currentStep);
        toast.info("Se restauró un borrador guardado", { duration: 4000 });
      } catch { /* ignore corrupt draft */ }
    }
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, secondaryLoaded, draftRestored]);

  // ── Load session + patient data ──
  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const [p, c, sc] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).single(),
        supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId).maybeSingle(),
        supabase.from("therapy_sessions").select("id", { count: "exact", head: true }).eq("patient_id", patientId).eq("is_deleted", false),
      ]);
      setPatient(p.data);
      setClinical(c.data);
      if (!isEditMode && sc.count != null) setSessionNumber(String(sc.count + 1));

      if (sessionId) {
        const [sessionRes, funcRes, analRes] = await Promise.all([
          supabase.from("therapy_sessions").select("*").eq("id", sessionId).eq("patient_id", patientId).eq("is_deleted", false).single(),
          supabase.from("functional_evaluations").select("*").eq("session_id", sessionId).maybeSingle(),
          supabase.from("analytical_evaluations").select("*").eq("session_id", sessionId).maybeSingle(),
        ]);
        if (!sessionRes.data) { setLoading(false); return; }
        const s = sessionRes.data;
        setEditingFuncEval(funcRes.data);
        setEditingAnalEval(analRes.data);
        setActiveEpisodeId(s.episode_id || episodeIdParam || null);
        setSessionDate(s.session_date || new Date().toISOString().split("T")[0]);
        setSessionType(s.session_type || "follow_up");
        setSessionNumber(s.session_number != null ? String(s.session_number) : "");
        setWeekAtSession(s.week_at_session != null ? String(s.week_at_session) : "");
        setGeneralObservations(s.general_observations || "");
        setSymptomChanges(s.symptom_changes || "");
        setClinicalChanges(s.clinical_changes || "");
        setAvdFollowup(s.avd_followup || "");
        setInterventions(s.interventions || "");
        setHomeInstructionsSent(s.home_instructions_sent || "");
        setNotes(s.notes || "");

        const fe = funcRes.data;
        if (fe) {
          setShowFunctional(true);
          setFuncDominance(fe.dominance || "");
          setFuncAvd(fe.avd || "");
          setFuncAivd(fe.aivd || "");
          setFuncSleep(fe.sleep_rest || "");
          setFuncHealth(fe.health_management || "");
          if (fe.fim_items && typeof fe.fim_items === "object") setFimItems(fe.fim_items as any);
          if (fe.barthel_items && typeof fe.barthel_items === "object") setBarthelItems(fe.barthel_items as any);
        }

        const ae = analRes.data;
        if (ae) {
          setShowMeasurements(true);
          const cfg = (ae as any).sections_config;
          const hasCfg = cfg && typeof cfg === "object";
          const hasPainsData = !!(ae.pain_score != null || ae.pain_appearance || ae.pain_location || ae.pain_characteristics || ae.pain_aggravating_factors || (ae as any).pain || ae.pain_radiation || (Array.isArray((ae as any).pains) && (ae as any).pains.length > 0));
          setShowPain(hasCfg ? !!cfg.pain : hasPainsData);
          setShowEdema(hasCfg ? !!cfg.edema : !!(ae.edema || ae.godet_test || ae.edema_circummetry));
          setShowMobility(hasCfg ? !!cfg.mobility : !!(ae.goniometry || ae.arom || ae.prom || ae.kapandji));
          setShowStrength(hasCfg ? !!cfg.strength : !!(ae.dynamometer_msd || ae.dynamometer_msi || ae.muscle_strength || ae.muscle_strength_daniels || ae.dppd_fingers));
          setShowSensitivity(hasCfg ? !!cfg.sensitivity : !!(ae.sensitivity || ae.sensitivity_tacto_ligero || ae.sensitivity_dos_puntos || ae.sensitivity_picking_up || ae.sensitivity_semmes_weinstein || ae.sensitivity_toco_pincho || ae.sensitivity_temperatura));
          setShowCicatriz(hasCfg ? !!cfg.cicatriz : !!(ae.scar || ae.scar_evaluation || ae.vancouver_score));
          setShowSpecificTests(hasCfg ? !!cfg.specific_tests : !!(ae.specific_tests && Object.values(ae.specific_tests as any).some((v: any) => v !== null)));
          setShowOtros(hasCfg ? !!cfg.otros : !!(ae.trophic_state || ae.posture || ae.emotional_state));

          const rawPains = (ae as any).pains;
          if (Array.isArray(rawPains) && rawPains.length > 0) {
            const loaded = rawPains.map((p: any, i: number) => ({
              id: i + 1, localizacion: p.localizacion || "", eva: p.eva ?? 0, evaTouched: p.eva != null,
              tipo: p.tipo || "" as PainTipo, aparicion: p.aparicion || "",
              irradia: p.irradia || "" as "no" | "si" | "", irradia_hacia: p.irradia_hacia || "",
              caracteristicas: p.caracteristicas || "", agravantes: p.agravantes || "", observaciones: p.observaciones || "",
            }));
            setPains(loaded);
            painsNextId.current = loaded.length + 1;
          } else if (hasPainsData) {
            const legacyIrradia = ae.pain_radiation === "No irradia" ? "no" : ae.pain_radiation ? "si" : "" as "no" | "si" | "";
            setPains([{
              id: 1, localizacion: (ae.pain_location || "").replace(/ — Irradia a:.*/, ""), eva: ae.pain_score || 0, evaTouched: ae.pain_score != null,
              tipo: "" as PainTipo, aparicion: ae.pain_appearance || "", irradia: legacyIrradia,
              irradia_hacia: ae.pain_radiation && ae.pain_radiation !== "No irradia" ? ae.pain_radiation : "",
              caracteristicas: ae.pain_characteristics || "", agravantes: ae.pain_aggravating_factors || "", observaciones: "",
            }]);
            painsNextId.current = 2;
          }

          setMobilityObservations((ae as any).mobility_observations || "");
          setEdemaObs(ae.edema || "");
          setGodetTest(ae.godet_test || "");
          const circ: any = ae.edema_circummetry;
          if (isCircometriaFormat(circ)) setEdemaCircItems(normalizeCircometriaValue(circ));

          if (ae.goniometry && typeof ae.goniometry === "object") {
            const toGonio = (arr: any) => {
              const base = emptySide();
              if (Array.isArray(arr)) arr.forEach((g: any) => { if (g?.body_part && base[g.body_part as GonioPartKey]) base[g.body_part as GonioPartKey] = Object.fromEntries(Object.entries(g.values || {}).map(([k,v]) => [k, String(v)])); });
              return base;
            };
            const g: any = ae.goniometry;
            if (g.arom !== undefined || g.prom !== undefined) {
              const aromData = g.arom || {};
              const promData = g.prom || {};
              if (aromData.MSD?.pre !== undefined || aromData.MSD?.post !== undefined || aromData.MSI?.pre !== undefined) {
                setAllPreGonio({ MSD: toGonio(aromData.MSD?.pre), MSI: toGonio(aromData.MSI?.pre) });
                setAllAromPostGonio({ MSD: toGonio(aromData.MSD?.post), MSI: toGonio(aromData.MSI?.post) });
                setShowAromPost(!!(aromData.MSD?.post || aromData.MSI?.post));
              } else {
                setAllPreGonio({ MSD: toGonio(aromData.MSD), MSI: toGonio(aromData.MSI) });
              }
              setShowArom(!!(aromData.MSD || aromData.MSI));
              if (promData.MSD?.pre !== undefined || promData.MSD?.post !== undefined || promData.MSI?.pre !== undefined) {
                setAllPromPreGonio({ MSD: toGonio(promData.MSD?.pre), MSI: toGonio(promData.MSI?.pre) });
                setAllPostGonio({ MSD: toGonio(promData.MSD?.post), MSI: toGonio(promData.MSI?.post) });
                setShowPromPost(!!(promData.MSD?.post || promData.MSI?.post));
              } else {
                setAllPostGonio({ MSD: toGonio(promData.MSD), MSI: toGonio(promData.MSI) });
              }
              setShowProm(!!(promData.MSD || promData.MSI));
            } else {
              const hasNew = g.MSD || g.MSI;
              if (hasNew) {
                setAllPreGonio({ MSD: toGonio(g.MSD?.pre), MSI: toGonio(g.MSI?.pre) });
                setAllPostGonio({ MSD: toGonio(g.MSD?.post), MSI: toGonio(g.MSI?.post) });
                setShowArom(true);
                setShowProm(!!(Array.isArray(g.MSD?.post) && g.MSD.post.length) || !!(Array.isArray(g.MSI?.post) && g.MSI.post.length));
              } else {
                setAllPreGonio({ MSD: toGonio(g.pre), MSI: emptySide() });
                setAllPostGonio({ MSD: toGonio(g.post), MSI: emptySide() });
                setShowArom(true);
                setShowProm(Array.isArray(g.post) && g.post.length > 0);
              }
            }
          }
          const kap = ae.kapandji || "";
          setKapandjiVal(kap.match(/^(\d+)/)?.[1] || "");
          setKapandjiPain(kap.includes("dolor"));
          setDynMsdVals(parseDyn(ae.dynamometer_msd));
          setDynMsiVals(parseDyn(ae.dynamometer_msi));
          setFistClosure((ae.muscle_strength || "").match(/Cierre de puño: ([^—]+)/)?.[1]?.trim() || "");
          if (Array.isArray(ae.muscle_strength_daniels) && ae.muscle_strength_daniels.length) {
            const rows = ae.muscle_strength_daniels.map((r: any, i: number) => ({ id: i + 1, muscle: r.muscle || "", grade: r.grade || "" }));
            setDanielsRows(rows);
            danielsNextId.current = rows.length + 1;
          }
          const dppd = (ae.dppd_fingers && typeof ae.dppd_fingers === "object" && !Array.isArray(ae.dppd_fingers) ? ae.dppd_fingers : {}) as Record<string, any>;
          setDppdPulgar(dppd.pulgar != null ? String(dppd.pulgar) : "");
          setDppdIndice(dppd.indice != null ? String(dppd.indice) : "");
          setDppdMedio(dppd.medio != null ? String(dppd.medio) : "");
          setDppdAnular(dppd.anular != null ? String(dppd.anular) : "");
          setDppdMenique(dppd.menique != null ? String(dppd.menique) : "");
          setSensitivity(ae.sensitivity || "");
          setSensitivityTactoLigero(ae.sensitivity_tacto_ligero || "");
          setSensitivityDosPuntos(ae.sensitivity_dos_puntos || "");
          setSensitivityPickingUp(ae.sensitivity_picking_up || "");
          setSensitivitySemmesWeinstein(ae.sensitivity_semmes_weinstein || "");
          setSensitivityTocoPincho(ae.sensitivity_toco_pincho || "");
          setSensitivityTemperatura(ae.sensitivity_temperatura || "");
          if (ae.specific_tests && typeof ae.specific_tests === "object") setSpecificTests(ae.specific_tests as any);
          const scar = (ae.scar_evaluation && typeof ae.scar_evaluation === "object" && !Array.isArray(ae.scar_evaluation) ? ae.scar_evaluation : {}) as Record<string, any>;
          setScarLocalizacion(scar.localizacion || "");
          setScarLongitud(scar.longitud_cm != null ? String(scar.longitud_cm) : "");
          setScarVascularizacion(scar.vascularizacion || "");
          setScarPigmentacion(scar.pigmentacion || "");
          setScarFlexibilidad(scar.flexibilidad || "");
          setScarSensibilidad(scar.sensibilidad || "");
          setScarRelieve(scar.relieve || "");
          setScarTemperatura(scar.temperatura || "");
          setScarObservaciones(ae.scar || "");
          setVssPigmentacion(scar.vss?.pigmentacion != null ? String(scar.vss.pigmentacion) : "");
          setVssVascularizacion(scar.vss?.vascularizacion != null ? String(scar.vss.vascularizacion) : "");
          setVssFlexibilidad(scar.vss?.flexibilidad != null ? String(scar.vss.flexibilidad) : "");
          setVssAltura(scar.vss?.altura != null ? String(scar.vss.altura) : "");
          setTrophicState(ae.trophic_state || "");
          setPosture(ae.posture || "");
          setEmotionalState(ae.emotional_state || "");
        }
        setLoading(false);
        return;
      }

      if (!episodeIdParam) {
        const { data: ep } = await supabase.from("treatment_episodes").select("id").eq("patient_id", patientId).eq("status", "active").eq("is_deleted", false).order("episode_number", { ascending: false }).limit(1).single();
        if (ep) setActiveEpisodeId(ep.id);
      }
      setLoading(false);
    };
    load();
  }, [patientId, sessionId]);

  // ── Load clinical record + occupational profile ──
  useEffect(() => {
    if (!patientId) return;
    setSecondaryLoaded(false);
    (async () => {
      const epId = activeEpisodeId;
      const cliQuery = supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId);
      const { data: cliRow } = epId ? await cliQuery.eq("episode_id", epId).maybeSingle() : await cliQuery.maybeSingle();
      if (cliRow) {
        setEditingClinicalId(cliRow.id);
        setCliDiagnosis(cliRow.diagnosis || "");
        setCliDoctorName(cliRow.doctor_name || "");
        setCliInjuryDate(cliRow.injury_date || "");
        setCliSurgeryDate(cliRow.surgery_date || "");
        setCliInjuryMechanism(cliRow.injury_mechanism || "");
        setCliTreatmentType(cliRow.treatment_type || "");
        setCliImmobWeeks(cliRow.immobilization_weeks != null ? String(cliRow.immobilization_weeks) : "");
        setCliImmobDays(cliRow.immobilization_days != null ? String(cliRow.immobilization_days) : "");
        setCliImmobType(cliRow.immobilization_type || "");
        setCliMedicalHistory(cliRow.medical_history || "");
        setCliPharma(cliRow.pharmacological_treatment || "");
        setCliStudies(cliRow.studies || "");
      }
      const { data: occRow } = await supabase.from("patient_occupational_profiles").select("*").eq("patient_id", patientId).maybeSingle();
      if (occRow) {
        setEditingOccId(occRow.id);
        setOccDominance(occRow.dominance || "");
        setOccSupportNetwork(occRow.support_network || "");
        setOccEducation(occRow.education || "");
        setOccJob(occRow.job || "");
        setOccLeisure(occRow.leisure || "");
        setOccPhysicalActivity(occRow.physical_activity || "");
        setOccSleepRest(occRow.sleep_rest || "");
        setOccHealthManagement(occRow.health_management || "");
      }
      if (activeEpisodeId) {
        const { data: epRow } = await supabase.from("treatment_episodes").select("affected_side, referral_date").eq("id", activeEpisodeId).maybeSingle();
        const affSide = (epRow?.affected_side as "MSD" | "MSI" | "both" | null) ?? null;
        if (affSide) setAffectedSide(affSide);
        setReferralDate(epRow?.referral_date || "");

        if (!sessionId && !isAdmission && affSide && affSide !== "both") {
          const { data: lastSess } = await supabase.from("therapy_sessions").select("id").eq("episode_id", activeEpisodeId).order("session_date", { ascending: false }).limit(1).maybeSingle();
          if (lastSess) {
            const { data: lastAe } = await supabase.from("analytical_evaluations").select("dynamometer_msd, dynamometer_msi").eq("session_id", lastSess.id).maybeSingle();
            if (lastAe) {
              if (affSide === "MSI") setDynMsdVals(parseDyn(lastAe.dynamometer_msd));
              if (affSide === "MSD") setDynMsiVals(parseDyn(lastAe.dynamometer_msi));
            }
          }
        }
      }
      setSecondaryLoaded(true);
    })();
  }, [patientId, activeEpisodeId]);

  // ── Auto-calc weeks from injury date ──
  const weekCalcSource: "injury" | "symptom" | null = clinical?.injury_date ? "injury" : clinical?.symptom_start_date ? "symptom" : null;
  useEffect(() => {
    if (!session_date || !clinical) return;
    const refDateStr = clinical.injury_date || clinical.symptom_start_date;
    if (!refDateStr) return;
    const ref = new Date(refDateStr + "T12:00:00");
    const sess = new Date(session_date + "T12:00:00");
    const days = differenceInCalendarDays(sess, ref);
    if (days < 0) return;
    setWeekAtSession(String(Math.floor(days / 7)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_date, clinical]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!patient)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-center text-muted-foreground py-12">Paciente no encontrado.</p>
      </div>
    );

  // ── Gonio helpers (used in handleSave) ──
  const buildAllGonioText = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const parts: string[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const fields = GONIO_PARTS[pk].fields;
      const entries = fields.map((f) => (vals[f.key] ? `${f.label}:${vals[f.key]}°` : "")).filter(Boolean);
      if (entries.length > 0) parts.push(`[${GONIO_PARTS[pk].label}] ${entries.join(" ")}`);
    }
    return parts.length > 0 ? parts.join(" ") : null;
  };

  const buildAllGonioJsonArray = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const arr: { body_part: string; values: Record<string, number> }[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const filled = Object.fromEntries(
        GONIO_PARTS[pk].fields
          .map((f) => [f.key, vals[f.key] ? Number(vals[f.key]) : null])
          .filter(([, v]) => v != null)
      );
      if (Object.keys(filled).length > 0) arr.push({ body_part: pk, values: filled as Record<string, number> });
    }
    return arr.length > 0 ? arr : null;
  };

  const validateNumerics = (): boolean => {
    const kap = numFieldErr(kapandji_val, 0, 10, "");
    const dyns = [...dyn_msd_vals, ...dyn_msi_vals].map(v => numFieldErr(v, 0, 200, "kgf"));
    const dppds = [dppd_pulgar, dppd_indice, dppd_medio, dppd_anular, dppd_menique].map(v => numFieldErr(v, 0, 30, "cm"));
    const checkGonioSide = (allVals: GonioBySide) =>
      (["MSD", "MSI"] as const).some(side =>
        Object.values(allVals[side]).some((partVals) =>
          Object.values(partVals as Record<string, string>).some(v => v.trim() && !!numFieldErr(v, 0, 360, "°"))
        )
      );
    return !(!!kap || dyns.some(Boolean) || dppds.some(Boolean) || checkGonioSide(all_pre_gonio) || checkGonioSide(all_arom_post_gonio) || checkGonioSide(all_prom_pre_gonio) || checkGonioSide(all_post_gonio));
  };

  const handleSave = async () => {
    if (!session_date || !user) return;
    if (!validateNumerics()) {
      toast.error("Hay campos numéricos con valores inválidos. Revisá las secciones marcadas antes de guardar.");
      return;
    }
    setSaving(true);

    const painsFiltered = pains.filter(p => p.localizacion || p.evaTouched || p.tipo || p.aparicion || p.irradia || p.caracteristicas || p.agravantes || p.observaciones);
    const painsJson = painsFiltered.length > 0
      ? painsFiltered.map(({ id: _id, evaTouched, ...p }) => ({
          localizacion: p.localizacion || null, eva: evaTouched ? p.eva : null, tipo: p.tipo || null,
          aparicion: p.aparicion || null, irradia: p.irradia || null,
          irradia_hacia: p.irradia === "si" ? p.irradia_hacia || null : null,
          caracteristicas: p.caracteristicas || null, agravantes: p.agravantes || null, observaciones: p.observaciones || null,
        }))
      : null;
    const evaValues = painsFiltered.filter(p => p.evaTouched).map(p => p.eva);
    const painScoreFinal = evaValues.length > 0 ? Math.max(...evaValues) : null;

    const edemaCirc = buildCircometriaPayload(edema_circ_items);

    const buildSideJsonb = () => {
      const arom: any = {};
      const prom: any = {};
      (["MSD", "MSI"] as const).forEach((side) => {
        if (show_arom) {
          const pre = buildAllGonioJsonArray(all_pre_gonio[side]);
          const post = show_arom_post ? buildAllGonioJsonArray(all_arom_post_gonio[side]) : null;
          if (pre || post) arom[side] = { pre: pre ?? null, post: post ?? null };
        }
        if (show_prom) {
          const pre = buildAllGonioJsonArray(all_prom_pre_gonio[side]);
          const post = show_prom_post ? buildAllGonioJsonArray(all_post_gonio[side]) : null;
          if (pre || post) prom[side] = { pre: pre ?? null, post: post ?? null };
        }
      });
      const hasArom = Object.keys(arom).length > 0;
      const hasProm = Object.keys(prom).length > 0;
      if (!hasArom && !hasProm) return null;
      return { arom: hasArom ? arom : null, prom: hasProm ? prom : null };
    };
    const buildSideText = (allVals: GonioBySide) => {
      const parts: string[] = [];
      (["MSD", "MSI"] as const).forEach((side) => {
        const t = buildAllGonioText(allVals[side]);
        if (t) parts.push(`[${side}] ${t}`);
      });
      return parts.length > 0 ? parts.join(" ") : null;
    };
    const aromVal = show_arom ? buildSideText(all_pre_gonio) : null;
    const promVal = show_prom ? buildSideText(all_prom_pre_gonio) : null;
    const gonioJsonb = buildSideJsonb();
    const kapandjiFinal = kapandji_val ? `${kapandji_val}/10${kapandji_pain ? " con dolor" : ""}` : null;

    const buildDyn = (vals: [string, string, string]) => {
      const nums = vals.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
      if (nums.length === 0) return null;
      const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      return { values: vals.map((v) => (v.trim() ? Number(v) : null)), average: avg };
    };
    const dynMsdJson = buildDyn(dyn_msd_vals);
    const dynMsiJson = buildDyn(dyn_msi_vals);

    const msParts: string[] = [];
    if (fist_closure) msParts.push(`Cierre de puño: ${fist_closure}`);
    const msVal = msParts.length > 0 ? msParts.join(" — ") : null;

    const danielsFiltered = danielsRows.filter(r => r.muscle.trim() && r.grade.trim()).map(r => ({ muscle: r.muscle.trim(), grade: r.grade }));
    const danielsJson = danielsFiltered.length > 0 ? danielsFiltered : null;

    const dppdEntries: [string, string][] = ([
      ["pulgar", dppd_pulgar], ["indice", dppd_indice], ["medio", dppd_medio], ["anular", dppd_anular], ["menique", dppd_menique],
    ].filter(([, v]) => v && v.trim()) as [string, string][]);
    const dppdFingersJson = dppdEntries.length > 0 ? Object.fromEntries(dppdEntries.map(([k, v]) => [k, parseFloat(v)])) : null;

    const generalObsFinal = session_type === "admission"
      ? discharge_summary || general_observations || null
      : [discharge_summary, general_observations].filter(Boolean).join("\n\n") || null;

    const hasTests = Object.values(specificTests).some((v) => v !== null);
    const specificTestsJson = hasTests ? Object.fromEntries(Object.entries(specificTests).map(([k, v]) => [k, v])) : null;

    const sessionPayload = {
      patient_id: patientId!, professional_id: user.id, is_deleted: false, episode_id: activeEpisodeId,
      session_date, session_type: session_type || null,
      session_number: session_number ? parseInt(session_number) : null,
      week_at_session: week_at_session ? parseInt(week_at_session) : null,
      general_observations: generalObsFinal, symptom_changes: symptom_changes || null,
      clinical_changes: clinical_changes || null, avd_followup: avd_followup || null,
      interventions: interventions || null, home_instructions_sent: home_instructions_sent || null, notes: notes || null,
    } as any;

    const { data: session, error } = isEditMode && sessionId
      ? await supabase.from("therapy_sessions").update(sessionPayload).eq("id", sessionId).eq("patient_id", patientId!).select().single()
      : await supabase.from("therapy_sessions").insert(sessionPayload).select().single();

    if (error || !session) {
      setSaving(false);
      toast.error(isEditMode ? "Error al actualizar la sesión" : "Error al guardar la sesión");
      return;
    }

    if (isAdmission) {
      const cliPayload: any = {
        patient_id: patientId!, episode_id: activeEpisodeId,
        diagnosis: cli_diagnosis.trim() || null, doctor_name: cli_doctor_name.trim() || null,
        injury_date: cli_injury_date || null, surgery_date: cli_surgery_date || null,
        injury_mechanism: cli_injury_mechanism.trim() || null, treatment_type: cli_treatment_type || null,
        immobilization_weeks: cli_immob_weeks ? parseInt(cli_immob_weeks) : null,
        immobilization_days: cli_immob_days ? parseInt(cli_immob_days) : null,
        immobilization_type: cli_immob_type.trim() || null, medical_history: cli_medical_history.trim() || null,
        pharmacological_treatment: cli_pharma.trim() || null, studies: cli_studies.trim() || null,
      };
      if (activeEpisodeId) {
        await supabase.from("treatment_episodes").update({ affected_side: affected_side ?? null, referral_date: referral_date || null }).eq("id", activeEpisodeId);
      }
      if (editingClinicalId) {
        const { error: cliErr } = await supabase.from("patient_clinical_records").update(cliPayload).eq("id", editingClinicalId);
        if (cliErr) { setSaving(false); toast.error("Error al guardar ficha clínica: " + cliErr.message); return; }
      } else {
        const { data: newCli, error: cliErr } = await supabase.from("patient_clinical_records").insert(cliPayload).select("id").single();
        if (cliErr) { setSaving(false); toast.error("Error al guardar ficha clínica: " + cliErr.message); return; }
        if (newCli) setEditingClinicalId(newCli.id);
      }
      const occPayload: any = {
        patient_id: patientId!, dominance: occ_dominance || null,
        support_network: occ_support_network.trim() || null, education: occ_education.trim() || null,
        job: occ_job.trim() || null, leisure: occ_leisure.trim() || null,
        physical_activity: occ_physical_activity.trim() || null, sleep_rest: occ_sleep_rest.trim() || null,
        health_management: occ_health_management.trim() || null, avd: func_avd || null, aivd: func_aivd || null,
      };
      if (editingOccId) {
        const { error: occErr } = await supabase.from("patient_occupational_profiles").update(occPayload).eq("id", editingOccId);
        if (occErr) { setSaving(false); toast.error("Error al guardar perfil ocupacional: " + occErr.message); return; }
      } else {
        const { data: newOcc, error: occErr } = await supabase.from("patient_occupational_profiles").insert(occPayload).select("id").single();
        if (occErr) { setSaving(false); toast.error("Error al guardar perfil ocupacional: " + occErr.message); return; }
        if (newOcc) setEditingOccId(newOcc.id);
      }
    }

    const fim_answered = Object.values(fim_items).some((v) => v !== null);
    const barthel_answered = Object.values(barthel_items).some((v) => v !== null);
    const hasFunctionalData = showFunctional && ([func_dominance, func_avd, func_aivd, func_sleep, func_health].some((v) => v) || fim_answered || barthel_answered);
    const functionalPayload = {
      patient_id: patientId!, professional_id: user.id, episode_id: activeEpisodeId, session_id: session.id,
      evaluation_date: session_date, dominance: (func_dominance || null) as any,
      avd: func_avd || null, aivd: func_aivd || null, sleep_rest: func_sleep || null, health_management: func_health || null,
      fim_items: fim_answered ? (fim_items as any) : null, fim_score: fim_answered ? calcFimTotal(fim_items) : null,
      barthel_items: barthel_answered ? (barthel_items as any) : null, barthel_score: barthel_answered ? calcBarthelTotal(barthel_items) : null,
    } as any;
    if (editingFuncEval) {
      const { error: feErr } = await supabase.from("functional_evaluations").update(functionalPayload).eq("id", editingFuncEval.id);
      if (feErr) console.error("Error updating func eval:", feErr);
    } else if (hasFunctionalData) {
      const { error: feErr } = await supabase.from("functional_evaluations").insert(functionalPayload);
      if (feErr) console.error("Error inserting func eval:", feErr);
    }

    const scarPlanillaEntries: [string, string][] = ([
      ["localizacion", scar_localizacion], ["longitud_cm", scar_longitud], ["vascularizacion", scar_vascularizacion],
      ["pigmentacion", scar_pigmentacion], ["flexibilidad", scar_flexibilidad], ["sensibilidad", scar_sensibilidad],
      ["relieve", scar_relieve], ["temperatura", scar_temperatura],
    ].filter(([, v]) => v && String(v).trim()) as [string, string][]);
    const vssObj: Record<string, number> = {};
    if (vss_pigmentacion !== "") vssObj.pigmentacion = parseInt(vss_pigmentacion);
    if (vss_vascularizacion !== "") vssObj.vascularizacion = parseInt(vss_vascularizacion);
    if (vss_flexibilidad !== "") vssObj.flexibilidad = parseInt(vss_flexibilidad);
    if (vss_altura !== "") vssObj.altura = parseInt(vss_altura);
    const vssTotal = Object.values(vssObj).reduce((a, b) => a + b, 0);
    const hasVss = Object.keys(vssObj).length > 0;
    const scarEvalJson = scarPlanillaEntries.length > 0 || hasVss
      ? { ...Object.fromEntries(scarPlanillaEntries), ...(hasVss ? { vss: vssObj } : {}) }
      : null;

    const hasMeasurements = show_measurements && [
      painsJson, edema_obs, godet_test, edemaCirc, aromVal, promVal, fist_closure, dynMsdJson, dynMsiJson,
      kapandjiFinal, msVal, danielsJson, sensitivity, sensitivity_tacto_ligero, sensitivity_dos_puntos,
      sensitivity_picking_up, sensitivity_semmes_weinstein, sensitivity_toco_pincho, sensitivity_temperatura,
      trophic_state, posture, emotional_state, specificTestsJson, gonioJsonb, dppdFingersJson, scarEvalJson, mobility_observations,
    ].some((v) => v !== "" && v !== null && v !== undefined && v !== false);

    const sectionsConfig = {
      pain: showPain, edema: showEdema, mobility: showMobility, strength: showStrength,
      sensitivity: showSensitivity, cicatriz: showCicatriz, specific_tests: showSpecificTests, otros: showOtros,
    };
    const analyticalPayload = {
      patient_id: patientId!, professional_id: user.id, episode_id: activeEpisodeId,
      session_id: session.id, evaluation_date: session_date,
      pains: painsJson as any, pain_score: painScoreFinal,
      pain_appearance: null, pain_location: null, pain_radiation: null, pain_characteristics: null, pain_aggravating_factors: null, pain: null,
      sections_config: sectionsConfig as any, edema: edema_obs || null, godet_test: godet_test || null,
      edema_circummetry: edemaCirc, arom: aromVal, prom: promVal, goniometry: gonioJsonb,
      dynamometer_msd: dynMsdJson as any, dynamometer_msi: dynMsiJson as any, kapandji: kapandjiFinal,
      muscle_strength: msVal, muscle_strength_median: null, muscle_strength_cubital: null, muscle_strength_radial: null,
      muscle_strength_daniels: danielsJson as any, mobility_observations: mobility_observations || null,
      specific_tests: specificTestsJson, dppd_fingers: dppdFingersJson,
      sensitivity: sensitivity || null, sensitivity_functional: null, sensitivity_protective: null,
      sensitivity_tacto_ligero: sensitivity_tacto_ligero || null, sensitivity_dos_puntos: sensitivity_dos_puntos || null,
      sensitivity_picking_up: sensitivity_picking_up || null, sensitivity_semmes_weinstein: sensitivity_semmes_weinstein || null,
      sensitivity_toco_pincho: sensitivity_toco_pincho || null, sensitivity_temperatura: sensitivity_temperatura || null,
      trophic_state: trophic_state || null, scar: scar_observaciones || null, scar_evaluation: scarEvalJson,
      vancouver_score: hasVss ? vssTotal : null, osas_score: null, posture: posture || null, emotional_state: emotional_state || null,
    } as any;

    if (editingAnalEval) {
      const { error: aeErr } = await supabase.from("analytical_evaluations").update(analyticalPayload).eq("id", editingAnalEval.id);
      if (aeErr) { setSaving(false); toast.error("Error al actualizar la evaluación de la sesión"); return; }
    } else if (hasMeasurements) {
      const { error: aeErr } = await supabase.from("analytical_evaluations").insert(analyticalPayload);
      if (aeErr) { setSaving(false); toast.error("Error al guardar la sesión"); return; }
    }

    if (session_type === "discharge") {
      await supabase.from("patients").update({ status: "discharged" }).eq("id", patientId!);
      if (activeEpisodeId) await supabase.from("treatment_episodes").update({ status: "discharged", discharge_date: session_date }).eq("id", activeEpisodeId);
    } else if (isEditMode) {
      const { data: remainingDischarges } = await supabase.from("therapy_sessions").select("id").eq("patient_id", patientId!).eq("session_type", "discharge").eq("is_deleted", false).limit(1);
      if (!remainingDischarges || remainingDischarges.length === 0) {
        await supabase.from("patients").update({ status: "active" }).eq("id", patientId!);
        if (activeEpisodeId) await supabase.from("treatment_episodes").update({ status: "active", discharge_date: null }).eq("id", activeEpisodeId);
      }
    }

    setSaving(false);
    clearDraft();
    toast.success(isEditMode ? "Sesión actualizada correctamente" : "Sesión registrada correctamente");
    navigate(`/patients/${patientId}`);
  };

  // ── Step / section helpers ──
  const sessionTitle = `${patient.last_name} — Sesión Nº ${session_number || "—"}`;
  const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;

  const sectionDone: Record<string, boolean> = {
    "sec-datos": !!session_date,
    "sec-ficha": !!cli_diagnosis,
    "sec-ocupacional": !!(occ_job || occ_dominance),
    "sec-funcional": showFunctional && (Object.values(fim_items).some(v => v !== null) || Object.values(barthel_items).some(v => v !== null)),
    "sec-evolucion": !!general_observations,
    "sec-analitica": show_measurements && (showPain || showEdema || showMobility || showStrength),
    "sec-intervenciones": !!interventions,
    "sec-notas": !!(notes || home_instructions_sent),
  };

  const steps = isAdmission ? STEPS_ADMISSION : STEPS_SESSION;
  const goToStep = (idx: number) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, idx)));
  const prevStep = () => goToStep(currentStep - 1);
  const nextStep = () => goToStep(currentStep + 1);
  const isLastStep = currentStep === steps.length - 1;
  const currentSections = steps[currentStep].sections;
  const stepDone = (step: typeof steps[0]) => step.sections.every(sid => sectionDone[sid] ?? false);

  // Shared analytical props
  const analiticaProps = {
    showPain, setShowPain, pains, setPains, painsNextId,
    showEdema, setShowEdema, edema_obs, setEdemaObs, godet_test, setGodetTest, edema_circ_items, setEdemaCircItems,
    showMobility, setShowMobility,
    all_pre_gonio, setAllPreGonio, show_arom, setShowArom, show_arom_post, setShowAromPost, all_arom_post_gonio, setAllAromPostGonio,
    show_prom, setShowProm, all_prom_pre_gonio, setAllPromPreGonio, show_prom_post, setShowPromPost, all_post_gonio, setAllPostGonio,
    mobility_observations, setMobilityObservations, kapandji_val, setKapandjiVal, kapandji_pain, setKapandjiPain, fist_closure, setFistClosure,
    showStrength, setShowStrength, isAdmission, affected_side, setAffectedSide,
    dyn_msd_vals, setDynMsdVals, dyn_msi_vals, setDynMsiVals,
    dppd_pulgar, setDppdPulgar, dppd_indice, setDppdIndice, dppd_medio, setDppdMedio, dppd_anular, setDppdAnular, dppd_menique, setDppdMenique,
    danielsRows, setDanielsRows, danielsNextId,
    showSensitivity, setShowSensitivity,
    sensitivity, setSensitivity, sensitivity_tacto_ligero, setSensitivityTactoLigero,
    sensitivity_dos_puntos, setSensitivityDosPuntos, sensitivity_picking_up, setSensitivityPickingUp,
    sensitivity_semmes_weinstein, setSensitivitySemmesWeinstein, sensitivity_toco_pincho, setSensitivityTocoPincho, sensitivity_temperatura, setSensitivityTemperatura,
    showCicatriz, setShowCicatriz,
    scar_localizacion, setScarLocalizacion, scar_longitud, setScarLongitud,
    scar_sensibilidad, setScarSensibilidad, scar_temperatura, setScarTemperatura,
    scar_observaciones, setScarObservaciones,
    vss_pigmentacion, setVssPigmentacion, vss_vascularizacion, setVssVascularizacion, vss_flexibilidad, setVssFlexibilidad, vss_altura, setVssAltura,
    showSpecificTests, setShowSpecificTests, specificTests, setSpecificTests,
    showOtros, setShowOtros, trophic_state, setTrophicState, posture, setPosture, emotional_state, setEmotionalState,
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-50 bg-card border-b border-border h-14 flex items-center px-4 shrink-0">
        <div className="w-full flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}`)} className="text-muted-foreground hover:text-foreground -ml-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{sessionTitle}</h1>
            {clinical?.diagnosis && <p className="text-xs text-muted-foreground truncate">{clinical.diagnosis}</p>}
          </div>
        </div>
      </header>

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <aside className="w-44 shrink-0 border-r border-border hidden lg:flex flex-col overflow-y-auto bg-background">
          <nav className="p-3 pt-4 space-y-0.5">
            {steps.map((s, idx) => {
              const done = stepDone(s);
              const isActive = currentStep === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <s.icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                  {done
                    ? <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Check className="h-2 w-2 text-emerald-600 stroke-[2.5]" /></span>
                    : <span className="w-3.5 h-3.5 rounded-full border border-border/60 shrink-0" />
                  }
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Scrollable form content */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile step indicator */}
          <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2 border-b border-border">
            <button type="button" onClick={prevStep} disabled={currentStep === 0} className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
              {currentStep > 0 ? steps[currentStep - 1].label : ""}
            </button>
            <span className="text-xs font-medium">{steps[currentStep].label} · {currentStep + 1}/{steps.length}</span>
            <button type="button" onClick={nextStep} disabled={isLastStep} className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40">
              {!isLastStep ? steps[currentStep + 1].label : ""}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="max-w-2xl mx-auto px-4 py-6">
            {currentSections.includes("sec-datos") && (
              <DatosStep
                session_date={session_date} setSessionDate={setSessionDate}
                session_type={session_type} setSessionType={setSessionType}
                session_number={session_number} setSessionNumber={setSessionNumber}
                week_at_session={week_at_session} setWeekAtSession={setWeekAtSession}
                discharge_summary={discharge_summary} setDischargeSummary={setDischargeSummary}
                weekCalcSource={weekCalcSource}
                isAdmission={isAdmission}
              />
            )}

            {isAdmission && currentSections.includes("sec-ficha") && (
              <FichaClinicaStep
                cli_diagnosis={cli_diagnosis} setCliDiagnosis={setCliDiagnosis}
                cli_doctor_name={cli_doctor_name} setCliDoctorName={setCliDoctorName}
                cli_injury_date={cli_injury_date} setCliInjuryDate={setCliInjuryDate}
                cli_surgery_date={cli_surgery_date} setCliSurgeryDate={setCliSurgeryDate}
                cli_injury_mechanism={cli_injury_mechanism} setCliInjuryMechanism={setCliInjuryMechanism}
                cli_treatment_type={cli_treatment_type} setCliTreatmentType={setCliTreatmentType}
                cli_immob_weeks={cli_immob_weeks} setCliImmobWeeks={setCliImmobWeeks}
                cli_immob_days={cli_immob_days} setCliImmobDays={setCliImmobDays}
                cli_immob_type={cli_immob_type} setCliImmobType={setCliImmobType}
                cli_medical_history={cli_medical_history} setCliMedicalHistory={setCliMedicalHistory}
                cli_pharma={cli_pharma} setCliPharma={setCliPharma}
                cli_studies={cli_studies} setCliStudies={setCliStudies}
                referral_date={referral_date} setReferralDate={setReferralDate}
              />
            )}

            {isAdmission && currentSections.includes("sec-ocupacional") && (
              <PerfilOcupacionalStep
                occ_dominance={occ_dominance} setOccDominance={setOccDominance}
                occ_support_network={occ_support_network} setOccSupportNetwork={setOccSupportNetwork}
                occ_education={occ_education} setOccEducation={setOccEducation}
                occ_job={occ_job} setOccJob={setOccJob}
                occ_leisure={occ_leisure} setOccLeisure={setOccLeisure}
                occ_physical_activity={occ_physical_activity} setOccPhysicalActivity={setOccPhysicalActivity}
                occ_sleep_rest={occ_sleep_rest} setOccSleepRest={setOccSleepRest}
                occ_health_management={occ_health_management} setOccHealthManagement={setOccHealthManagement}
              />
            )}

            {currentSections.includes("sec-funcional") && (
              <FuncionalStep
                func_avd={func_avd} setFuncAvd={setFuncAvd}
                func_aivd={func_aivd} setFuncAivd={setFuncAivd}
                fim_items={fim_items} setFimItems={setFimItems}
                barthel_items={barthel_items} setBarthelItems={setBarthelItems}
              />
            )}

            {!isAdmission && currentSections.includes("sec-evolucion") && (
              <EvolucionStep
                general_observations={general_observations} setGeneralObservations={setGeneralObservations}
                symptom_changes={symptom_changes} setSymptomChanges={setSymptomChanges}
                clinical_changes={clinical_changes} setClinicalChanges={setClinicalChanges}
                avd_followup={avd_followup} setAvdFollowup={setAvdFollowup}
                session_number={session_number}
                week_at_session={week_at_session}
              />
            )}

            {currentSections.includes("sec-analitica") && <AnaliticaStep {...analiticaProps} />}

            {(currentSections.includes("sec-intervenciones") || currentSections.includes("sec-notas")) && (
              <CierreStep
                interventions={interventions} setInterventions={setInterventions}
                home_instructions_sent={home_instructions_sent} setHomeInstructionsSent={setHomeInstructionsSent}
                notes={notes} setNotes={setNotes}
              />
            )}

            {/* Step navigation */}
            <div className="flex justify-between items-center pt-2 pb-8 px-1">
              <Button variant="ghost" size="sm" disabled={currentStep === 0} onClick={prevStep} className="text-muted-foreground gap-1">
                <ChevronLeft className="h-4 w-4" />
                {currentStep > 0 ? steps[currentStep - 1].label : ""}
              </Button>
              <Button variant="ghost" size="sm" disabled={isLastStep} onClick={nextStep} className="text-muted-foreground gap-1">
                {!isLastStep ? steps[currentStep + 1].label : ""}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Floating save button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={saving || !session_date}
          className="bg-primary hover:bg-primary/85 shadow-lg gap-2 px-5"
          size="default"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Guardando..." : isEditMode ? "Actualizar sesión" : "Guardar sesión"}
        </Button>
      </div>
    </div>
  );
}
