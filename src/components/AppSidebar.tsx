import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, PlusCircle, Video,
  PenTool, Brain, Users, Settings, LogOut, Trophy
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/playbooks", icon: BookOpen, label: "Playbooks" },
  { href: "/create", icon: PlusCircle, label: "Create Play" },
  { href: "/videos", icon: Video, label: "Videos" },
  { href: "/whiteboard", icon: PenTool, label: "Whiteboard" },
  { href: "/coach-ai", icon: Brain, label: "AI Coach" },
  { href: "/team", icon: Users, label: "Team" },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-bold">Playbook Pro</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || "Coach"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
