import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import AcceptInvitePage from "@/pages/AcceptInvite";
import ActivityPage from "@/pages/Activity";
import BoardPage from "@/pages/Board";
import DashboardPage from "@/pages/Dashboard";
import LabelsPage from "@/pages/Labels";
import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import MembersPage from "@/pages/Members";
import NotFoundPage from "@/pages/NotFound";
import ProjectsPage from "@/pages/Projects";
import SettingsPage from "@/pages/Settings";
import SignupPage from "@/pages/Signup";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/board" element={<BoardPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="labels" element={<LabelsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
