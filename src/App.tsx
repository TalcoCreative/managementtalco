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
import ClientDetail from "./pages/ClientDetail";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Users from "./pages/Users";
import Schedule from "./pages/Schedule";
import Reports from "./pages/Reports";
import HRDashboard from "./pages/HRDashboard";
import HRAnalytics from "./pages/HRAnalytics";
import EmployeeInsight from "./pages/EmployeeInsight";
import ShootingSchedule from "./pages/ShootingSchedule";
import Leave from "./pages/Leave";
import Finance from "./pages/Finance";
import IncomeStatementPage from "./pages/IncomeStatementPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import MyReimbursement from "./pages/MyReimbursement";
import Prospects from "./pages/Prospects";
import ProspectHistory from "./pages/ProspectHistory";
import SalesDashboard from "./pages/SalesDashboard";
import Performance from "./pages/Performance";
import Recruitment from "./pages/Recruitment";
import RecruitmentForms from "./pages/RecruitmentForms";
import RecruitmentDashboard from "./pages/RecruitmentDashboard";
import PublicApplyForm from "./pages/PublicApplyForm";
import Meeting from "./pages/Meeting";
import Asset from "./pages/Asset";
import Letters from "./pages/Letters";
import KolDatabase from "./pages/KolDatabase";
import KolCampaign from "./pages/KolCampaign";
import Event from "./pages/Event";
import EventDetail from "./pages/EventDetail";
import SharedTask from "./pages/SharedTask";
import SharedProject from "./pages/SharedProject";
import SharedShooting from "./pages/SharedShooting";
import SharedMeeting from "./pages/SharedMeeting";
import SocialMedia from "./pages/SocialMedia";
import SocialMediaModule from "./pages/SocialMediaModule";
import SocialMediaSettings from "./pages/SocialMediaSettings";
import SharedSocialMedia from "./pages/SharedSocialMedia";
import EmailSettings from "./pages/EmailSettings";
import NotFound from "./pages/NotFound";
import SharedShortUrl from "./pages/SharedShortUrl";
import SharedClientDashboard from "./pages/SharedClientDashboard";

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
          <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/hr-dashboard" element={<ProtectedRoute><HRDashboard /></ProtectedRoute>} />
          <Route path="/hr/analytics" element={<ProtectedRoute><HRAnalytics /></ProtectedRoute>} />
          <Route path="/hr/employee/:id/insight" element={<ProtectedRoute><EmployeeInsight /></ProtectedRoute>} />
          <Route path="/shooting" element={<ProtectedRoute><ShootingSchedule /></ProtectedRoute>} />
          <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/finance/laporan-laba-rugi" element={<ProtectedRoute><IncomeStatementPage /></ProtectedRoute>} />
          <Route path="/finance/neraca" element={<ProtectedRoute><BalanceSheetPage /></ProtectedRoute>} />
          <Route path="/my-reimbursement" element={<ProtectedRoute><MyReimbursement /></ProtectedRoute>} />
          <Route path="/prospects" element={<ProtectedRoute><Prospects /></ProtectedRoute>} />
          <Route path="/prospects/history" element={<ProtectedRoute><ProspectHistory /></ProtectedRoute>} />
          <Route path="/sales/dashboard" element={<ProtectedRoute><SalesDashboard /></ProtectedRoute>} />
          <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
          <Route path="/recruitment" element={<ProtectedRoute><Recruitment /></ProtectedRoute>} />
          <Route path="/recruitment/forms" element={<ProtectedRoute><RecruitmentForms /></ProtectedRoute>} />
          <Route path="/recruitment/dashboard" element={<ProtectedRoute><RecruitmentDashboard /></ProtectedRoute>} />
          <Route path="/apply/:slug" element={<PublicApplyForm />} />
          <Route path="/meeting" element={<ProtectedRoute><Meeting /></ProtectedRoute>} />
          <Route path="/asset" element={<ProtectedRoute><Asset /></ProtectedRoute>} />
          <Route path="/letters" element={<ProtectedRoute><Letters /></ProtectedRoute>} />
          <Route path="/kol-database" element={<ProtectedRoute><KolDatabase /></ProtectedRoute>} />
          <Route path="/kol-campaign" element={<ProtectedRoute><KolCampaign /></ProtectedRoute>} />
          <Route path="/event" element={<ProtectedRoute><Event /></ProtectedRoute>} />
          <Route path="/event/:eventId" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
          <Route path="/social-media" element={<ProtectedRoute><SocialMediaModule /></ProtectedRoute>} />
          <Route path="/social-media/settings" element={<ProtectedRoute><SocialMediaSettings /></ProtectedRoute>} />
          <Route path="/social-media/client/:slug" element={<SharedSocialMedia />} />
          <Route path="/ceo-dashboard" element={<ProtectedRoute><CEODashboard /></ProtectedRoute>} />
          <Route path="/system/email-settings" element={<ProtectedRoute><EmailSettings /></ProtectedRoute>} />
          <Route path="/projects/task/:token" element={<SharedTask />} />
          <Route path="/share/task/:token" element={<SharedTask />} />
          <Route path="/share/project/:token" element={<SharedProject />} />
          <Route path="/share/shooting/:token" element={<SharedShooting />} />
          <Route path="/share/meeting/:token" element={<SharedMeeting />} />
          <Route path="/dashboard/:slug" element={<SharedClientDashboard />} />
          <Route path="/clients/public/:slug" element={<SharedClientDashboard />} />
          <Route path="/:token" element={<SharedShortUrl />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
