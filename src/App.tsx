import { Toaster } from "@/components/ui/toaster";
import CEODashboard from "./pages/CEODashboard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
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
import Forms from "./pages/Forms";
import FormEditor from "./pages/FormEditor";
import FormResponses from "./pages/FormResponses";
import PublicForm from "./pages/PublicForm";
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
import ContentBuilder from "./pages/ContentBuilder";
import EmailSettings from "./pages/EmailSettings";
import NotFound from "./pages/NotFound";
import SharedShortUrl from "./pages/SharedShortUrl";
import SharedClientDashboard from "./pages/SharedClientDashboard";
import SharedClientReports from "./pages/SharedClientReports";
import Holiday from "./pages/Holiday";
import EditorialPlan from "./pages/EditorialPlan";
import EditorialPlanEditor from "./pages/EditorialPlanEditor";
import PublicEditorialPlan from "./pages/PublicEditorialPlan";
import PublicEditorialPlanList from "./pages/PublicEditorialPlanList";
import PublicClientHub from "./pages/PublicClientHub";
import HubLayout from "./components/public-hub/HubLayout";
import PublishedContent from "./pages/PublishedContent";
import PublicMeetingList from "./pages/PublicMeetingList";
import PublicShootingList from "./pages/PublicShootingList";
import PublicMarketplace from "./pages/PublicMarketplace";
import PublicKolCampaign from "./pages/PublicKolCampaign";
import RoleManagement from "./pages/RoleManagement";
import SystemSettings from "./pages/SystemSettings";
import ProfileSettings from "./pages/ProfileSettings";
import PersonalNotes from "./pages/PersonalNotes";
import InstallApp from "./pages/InstallApp";
import NotificationLog from "./pages/NotificationLog";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataDeletion from "./pages/DataDeletion";
import { HelmetProvider } from "react-helmet-async";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
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
          <Route path="/hr/holiday" element={<ProtectedRoute><Holiday /></ProtectedRoute>} />
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
          <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
          <Route path="/forms/:formId" element={<ProtectedRoute><FormEditor /></ProtectedRoute>} />
          <Route path="/forms/:formId/responses" element={<ProtectedRoute><FormResponses /></ProtectedRoute>} />
          <Route path="/f/:slug" element={<PublicForm />} />
          <Route path="/meeting" element={<ProtectedRoute><Meeting /></ProtectedRoute>} />
          <Route path="/asset" element={<ProtectedRoute><Asset /></ProtectedRoute>} />
          <Route path="/letters" element={<ProtectedRoute><Letters /></ProtectedRoute>} />
          <Route path="/kol-database" element={<ProtectedRoute><KolDatabase /></ProtectedRoute>} />
          <Route path="/kol-campaign" element={<ProtectedRoute><KolCampaign /></ProtectedRoute>} />
          <Route path="/event" element={<ProtectedRoute><Event /></ProtectedRoute>} />
          <Route path="/event/:eventId" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
          <Route path="/social-media" element={<ProtectedRoute><SocialMediaModule /></ProtectedRoute>} />
          <Route path="/social-media/settings" element={<ProtectedRoute><SocialMediaSettings /></ProtectedRoute>} />
          <Route path="/social-media/client/:slug" element={<HubLayout />}>
            <Route index element={<SharedSocialMedia />} />
          </Route>
          <Route path="/content-builder" element={<ProtectedRoute><ContentBuilder /></ProtectedRoute>} />
          <Route path="/editorial-plan" element={<ProtectedRoute><EditorialPlan /></ProtectedRoute>} />
          <Route path="/ep/:clientSlug/:epSlug/edit" element={<ProtectedRoute><EditorialPlanEditor /></ProtectedRoute>} />
          <Route path="/ep/:clientSlug/:epSlug" element={<PublicEditorialPlan />} />
          <Route path="/ep-list/:clientSlug" element={<HubLayout />}>
            <Route index element={<PublicEditorialPlanList />} />
          </Route>
          <Route path="/ceo-dashboard" element={<ProtectedRoute><CEODashboard /></ProtectedRoute>} />
          <Route path="/reports/published-content" element={<ProtectedRoute><PublishedContent /></ProtectedRoute>} />
          <Route path="/system/email-settings" element={<ProtectedRoute><EmailSettings /></ProtectedRoute>} />
          <Route path="/system/roles" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
          <Route path="/system/settings" element={<ProtectedRoute><SystemSettings /></ProtectedRoute>} />
          <Route path="/profile-settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
          <Route path="/personal-notes" element={<ProtectedRoute><PersonalNotes /></ProtectedRoute>} />
          <Route path="/install-app" element={<InstallApp />} />
          <Route path="/notification-log" element={<ProtectedRoute><NotificationLog /></ProtectedRoute>} />
          <Route path="/projects/task/:token" element={<SharedTask />} />
          <Route path="/share/task/:token" element={<SharedTask />} />
          <Route path="/share/project/:token" element={<SharedProject />} />
          <Route path="/share/shooting/:token" element={<SharedShooting />} />
          <Route path="/share/meeting/:token" element={<SharedMeeting />} />
          <Route path="/dashboard/:slug" element={<HubLayout />}>
            <Route index element={<SharedClientDashboard />} />
          </Route>
          <Route path="/clients/public/:slug" element={<SharedClientDashboard />} />
          <Route path="/reports/:slug" element={<HubLayout />}>
            <Route index element={<SharedClientReports />} />
          </Route>
          <Route path="/hub/:slug" element={<HubLayout />}>
            <Route index element={<PublicClientHub />} />
          </Route>
          <Route path="/meeting-list/:clientSlug" element={<HubLayout />}>
            <Route index element={<PublicMeetingList />} />
          </Route>
          <Route path="/shooting-list/:clientSlug" element={<HubLayout />}>
            <Route index element={<PublicShootingList />} />
          </Route>
          <Route path="/marketplace/:clientSlug" element={<HubLayout />}>
            <Route index element={<PublicMarketplace />} />
          </Route>
          <Route path="/kol-campaign/:clientSlug" element={<HubLayout />}>
            <Route index element={<PublicKolCampaign />} />
          </Route>
          <Route path="/:token" element={<SharedShortUrl />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
