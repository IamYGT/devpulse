import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
