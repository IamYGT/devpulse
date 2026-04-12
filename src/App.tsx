import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./dashboard/Dashboard";
import ErrorBoundary from "./components/ErrorBoundary";

import "./app.css";

// Lazy load all pages for better performance and crash isolation
const TodayPage = lazy(() => import("./dashboard/pages/TodayPage"));
const WeekPage = lazy(() => import("./dashboard/pages/WeekPage"));
const GitPage = lazy(() => import("./dashboard/pages/GitPage"));
const BudgetPage = lazy(() => import("./dashboard/pages/BudgetPage"));
const SettingsPage = lazy(() => import("./dashboard/pages/SettingsPage"));
const PomodoroPage = lazy(() => import("./dashboard/pages/PomodoroPage"));
const MonthlyPage = lazy(() => import("./dashboard/pages/MonthlyPage"));
const ExportPage = lazy(() => import("./dashboard/pages/ExportPage"));
const ExtensionsPage = lazy(() => import("./dashboard/pages/ExtensionsPage"));
const ActivityPage = lazy(() => import("./dashboard/pages/ActivityPage"));
const InsightsPage = lazy(() => import("./dashboard/pages/InsightsPage"));
const SchedulerPage = lazy(() => import("./dashboard/pages/SchedulerPage"));
const EnforcementPage = lazy(() => import("./dashboard/pages/EnforcementPage"));
const ProjectsPage = lazy(() => import("./dashboard/pages/ProjectsPage"));
const MorningBriefPage = lazy(() => import("./dashboard/pages/MorningBriefPage"));
const WelcomePage = lazy(() => import("./dashboard/pages/WelcomePage"));
const AutomationPage = lazy(() => import("./dashboard/pages/AutomationPage"));
const DataHealthPage = lazy(() => import("./dashboard/pages/DataHealthPage"));
const NotesPage = lazy(() => import("./dashboard/pages/NotesPage"));

function PageLoader() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      Yukleniyor...
    </div>
  );
}

function SafePage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<SafePage><TodayPage /></SafePage>} />
          <Route path="week" element={<SafePage><WeekPage /></SafePage>} />
          <Route path="git" element={<SafePage><GitPage /></SafePage>} />
          <Route path="budget" element={<SafePage><BudgetPage /></SafePage>} />
          <Route path="settings" element={<SafePage><SettingsPage /></SafePage>} />
          <Route path="pomodoro" element={<SafePage><PomodoroPage /></SafePage>} />
          <Route path="monthly" element={<SafePage><MonthlyPage /></SafePage>} />
          <Route path="export" element={<SafePage><ExportPage /></SafePage>} />
          <Route path="extensions" element={<SafePage><ExtensionsPage /></SafePage>} />
          <Route path="activity" element={<SafePage><ActivityPage /></SafePage>} />
          <Route path="insights" element={<SafePage><InsightsPage /></SafePage>} />
          <Route path="scheduler" element={<SafePage><SchedulerPage /></SafePage>} />
          <Route path="enforcement" element={<SafePage><EnforcementPage /></SafePage>} />
          <Route path="projects" element={<SafePage><ProjectsPage /></SafePage>} />
          <Route path="morning" element={<SafePage><MorningBriefPage /></SafePage>} />
          <Route path="welcome" element={<SafePage><WelcomePage onComplete={() => {}} /></SafePage>} />
          <Route path="automation" element={<SafePage><AutomationPage /></SafePage>} />
          <Route path="data-health" element={<SafePage><DataHealthPage /></SafePage>} />
          <Route path="notes" element={<SafePage><NotesPage /></SafePage>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
