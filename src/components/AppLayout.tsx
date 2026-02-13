import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "./AppSidebar";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
