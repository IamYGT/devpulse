import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./dashboard/Dashboard";
import TodayPage from "./dashboard/pages/TodayPage";
import WeekPage from "./dashboard/pages/WeekPage";
import GitPage from "./dashboard/pages/GitPage";
import BudgetPage from "./dashboard/pages/BudgetPage";
import SettingsPage from "./dashboard/pages/SettingsPage";
import PomodoroPage from "./dashboard/pages/PomodoroPage";
import MonthlyPage from "./dashboard/pages/MonthlyPage";
import ExportPage from "./dashboard/pages/ExportPage";

import "./app.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<TodayPage />} />
          <Route path="week" element={<WeekPage />} />
          <Route path="git" element={<GitPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="pomodoro" element={<PomodoroPage />} />
          <Route path="monthly" element={<MonthlyPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
