import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ErrorBoundary from "../components/ErrorBoundary";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main className="content" id="main-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
