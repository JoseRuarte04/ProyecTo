import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
