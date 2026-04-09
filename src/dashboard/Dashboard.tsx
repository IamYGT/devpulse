import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import EnforcementOverlay from "./components/EnforcementOverlay";
import BreakEnforcer from "./components/BreakEnforcer";
import DayEndSummary from "./components/DayEndSummary";
import SkipLink from "../components/SkipLink";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const key = `devpulse_brief_shown_${today}`;
    const hour = new Date().getHours();

    if (!localStorage.getItem(key) && hour >= 6 && hour <= 12) {
      // Auto-navigate to morning brief on first open of the day
      if (location.pathname === "/") {
        navigate("/morning");
        localStorage.setItem(key, "true");
      }
    }
  }, []);

  return (
    <div className="dashboard">
      <SkipLink />
      <EnforcementOverlay />
      <BreakEnforcer />
      <Sidebar />
      <main className="content" id="main-content">
        <Outlet />
      </main>
      <DayEndSummary />
    </div>
  );
}
