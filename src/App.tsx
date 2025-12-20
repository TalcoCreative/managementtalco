import { Toaster } from "@/components/ui/toaster";
import CEODashboard from "./pages/CEODashboard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Users from "./pages/Users";
import Schedule from "./pages/Schedule";
import Reports from "./pages/Reports";
import HRDashboard from "./pages/HRDashboard";
import ShootingSchedule from "./pages/ShootingSchedule";
import Leave from "./pages/Leave";
import Finance from "./pages/Finance";
import MyReimbursement from "./pages/MyReimbursement";
import Prospects from "./pages/Prospects";
import Performance from "./pages/Performance";
import Recruitment from "./pages/Recruitment";
import Meeting from "./pages/Meeting";
import Asset from "./pages/Asset";
import Letters from "./pages/Letters";
import KolDatabase from "./pages/KolDatabase";
import KolCampaign from "./pages/KolCampaign";
import Event from "./pages/Event";
import EventDetail from "./pages/EventDetail";
import SharedTask from "./pages/SharedTask";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/hr-dashboard" element={<ProtectedRoute><HRDashboard /></ProtectedRoute>} />
          <Route path="/shooting" element={<ProtectedRoute><ShootingSchedule /></ProtectedRoute>} />
          <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/my-reimbursement" element={<ProtectedRoute><MyReimbursement /></ProtectedRoute>} />
          <Route path="/prospects" element={<ProtectedRoute><Prospects /></ProtectedRoute>} />
          <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
          <Route path="/recruitment" element={<ProtectedRoute><Recruitment /></ProtectedRoute>} />
          <Route path="/meeting" element={<ProtectedRoute><Meeting /></ProtectedRoute>} />
          <Route path="/asset" element={<ProtectedRoute><Asset /></ProtectedRoute>} />
          <Route path="/letters" element={<ProtectedRoute><Letters /></ProtectedRoute>} />
          <Route path="/kol-database" element={<ProtectedRoute><KolDatabase /></ProtectedRoute>} />
          <Route path="/kol-campaign" element={<ProtectedRoute><KolCampaign /></ProtectedRoute>} />
          <Route path="/event" element={<ProtectedRoute><Event /></ProtectedRoute>} />
          <Route path="/event/:eventId" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
          <Route path="/ceo-dashboard" element={<ProtectedRoute><CEODashboard /></ProtectedRoute>} />
          <Route path="/shared/task/:token" element={<SharedTask />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
