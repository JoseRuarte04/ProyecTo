import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Code-splitting por ruta: cada página se descarga recién cuando se navega a ella.
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientProfile = lazy(() => import("./pages/PatientProfile"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Exercises = lazy(() => import("./pages/Exercises"));
const Profile = lazy(() => import("./pages/Profile"));
const SessionForm = lazy(() => import("./pages/SessionForm"));
const NewPatientForm = lazy(() => import("./components/patients/NewPatientForm"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AnalyticalEvaluationPage = lazy(() => import("./pages/AnalyticalEvaluationPage"));
const FunctionalEvaluationPage = lazy(() => import("./pages/FunctionalEvaluationPage"));
const QuickDashPublicPage = lazy(() => import("./pages/QuickDashPublicPage"));
const PlanPublicPage = lazy(() => import("./pages/PlanPublicPage"));
const WorkspacePicker = lazy(() => import("./pages/WorkspacePicker"));
const MiEquipo = lazy(() => import("./pages/MiEquipo"));
const InvitationRegister = lazy(() => import("./pages/InvitationRegister"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTherapists = lazy(() => import("./pages/admin/AdminTherapists"));
const AdminTeams = lazy(() => import("./pages/admin/AdminTeams"));
const AdminTeamDetail = lazy(() => import("./pages/admin/AdminTeamDetail"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminPatients = lazy(() => import("./pages/admin/AdminPatients"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Selector de workspace — requiere auth, no requiere AppLayout */}
              <Route path="/workspace-picker" element={<WorkspacePicker />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/new" element={<NewPatientForm />} />
                <Route path="patients/:id" element={<PatientProfile />} />
                <Route path="patients/:patientId/sessions/new" element={<SessionForm />} />
                <Route path="patients/:patientId/sessions/:sessionId/edit" element={<SessionForm />} />
                <Route path="patients/:patientId/evaluations/analytical/:evalId" element={<AnalyticalEvaluationPage />} />
                <Route path="patients/:patientId/evaluations/functional/:evalId" element={<FunctionalEvaluationPage />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="exercises" element={<Exercises />} />
                <Route path="profile" element={<Profile />} />
                <Route path="mi-equipo" element={<MiEquipo />} />
              </Route>
              <Route path="/registro" element={<InvitationRegister />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/q/:token" element={<QuickDashPublicPage />} />
              <Route path="/plan/:token" element={<PlanPublicPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard"  element={<AdminDashboard />} />
                <Route path="therapists" element={<AdminTherapists />} />
                <Route path="teams"      element={<AdminTeams />} />
                <Route path="teams/:id"  element={<AdminTeamDetail />} />
                <Route path="patients"   element={<AdminPatients />} />
                <Route path="activity"   element={<AdminActivity />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
