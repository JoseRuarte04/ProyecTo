import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientProfile from "./pages/PatientProfile";
import Appointments from "./pages/Appointments";
import Exercises from "./pages/Exercises";
import SessionForm from "./pages/SessionForm";
import NewPatientForm from "./components/patients/NewPatientForm";
import NotFound from "./pages/NotFound";
import AnalyticalEvaluationPage from "./pages/AnalyticalEvaluationPage";
import FunctionalEvaluationPage from "./pages/FunctionalEvaluationPage";
import QuickDashPublicPage from "./pages/QuickDashPublicPage";
import PlanPublicPage from "./pages/PlanPublicPage";
import { AdminLayout } from "@/components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTherapists from "./pages/admin/AdminTherapists";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminTeamDetail from "./pages/admin/AdminTeamDetail";
import AdminActivity from "./pages/admin/AdminActivity";
import MiEquipo from "./pages/MiEquipo";
import InvitationRegister from "./pages/InvitationRegister";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={<Login />} />
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
                <Route path="mi-equipo" element={<MiEquipo />} />
              </Route>
              <Route path="/registro" element={<InvitationRegister />} />
              <Route path="/q/:token" element={<QuickDashPublicPage />} />
              <Route path="/plan/:token" element={<PlanPublicPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard"  element={<AdminDashboard />} />
                <Route path="therapists" element={<AdminTherapists />} />
                <Route path="teams"      element={<AdminTeams />} />
                <Route path="teams/:id"  element={<AdminTeamDetail />} />
                <Route path="activity"   element={<AdminActivity />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
