import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ErrorBoundary from "../components/ErrorBoundary";

// Lazy load global overlays - if they crash, ErrorBoundary catches it
const EnforcementOverlay = React.lazy(() => import("./components/EnforcementOverlay"));
const BreakEnforcer = React.lazy(() => import("./components/BreakEnforcer"));
const DayEndSummary = React.lazy(() => import("./components/DayEndSummary"));
const QuickCapture = React.lazy(() => import("./notes/QuickCapture"));

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* Global overlays - wrapped in ErrorBoundary so crashes don't kill the app */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <EnforcementOverlay />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <BreakEnforcer />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <DayEndSummary />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <QuickCapture />
        </Suspense>
      </ErrorBoundary>

      <Sidebar />
      <main className="content" id="main-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
