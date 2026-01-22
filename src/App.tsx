import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfileGuard } from "@/components/ProfileGuard";
import { DashboardLayout } from "@/components/DashboardLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import SetupPassword from "./pages/SetupPassword";
import CreateWorkspaceNew from "./pages/onboarding/CreateWorkspaceNew";
import CreateProfile from "./pages/onboarding/CreateProfile";
import InviteTeamNew from "./pages/onboarding/InviteTeamNew";
import Dashboard from "./pages/Dashboard";
import PortfolioPage from "./pages/PortfolioPage";
import SubmitDeal from "./pages/SubmitDeal";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import AcceptInvite from "./pages/AcceptInvite";

import DealDetail from "./pages/DealDetail";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import '@/i18n/config';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/setup-password" element={<SetupPassword />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              
              {/* Onboarding routes - new Twenty CRM style flow */}
              <Route path="/onboarding/workspace" element={
                <ProtectedRoute>
                  <CreateWorkspaceNew />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/profile" element={
                <ProtectedRoute>
                  <CreateProfile />
                </ProtectedRoute>
              } />
              <Route path="/onboarding/invite" element={
                <ProtectedRoute>
                  <InviteTeamNew />
                </ProtectedRoute>
              } />
              
              {/* Protected routes - require complete profile */}
              <Route
                path="/opportunities"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <Dashboard />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portfolio"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <PortfolioPage />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <Dashboard />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/submit"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <SubmitDeal />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deal/:id"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <DealDetail />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <Profile />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <Admin />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <ProfileGuard>
                      <DashboardLayout>
                        <WorkspaceSettings />
                      </DashboardLayout>
                    </ProfileGuard>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
