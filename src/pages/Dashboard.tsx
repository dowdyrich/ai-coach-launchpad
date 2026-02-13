import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, PlayCircle, Video, Users, Plus, ArrowRight, Brain, PenTool } from "lucide-react";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ teams: 0, playbooks: 0, plays: 0, videos: 0 });

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      const [teams, playbooks] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact", head: true }),
        supabase.from("playbooks").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        teams: teams.count || 0,
        playbooks: playbooks.count || 0,
        plays: 0,
        videos: 0,
      });
    };
    fetchStats();
  }, [user]);

  const quickActions = [
    { icon: Plus, label: "New Playbook", href: "/playbooks", color: "bg-primary" },
    { icon: PlayCircle, label: "Create Play", href: "/create", color: "bg-secondary" },
    { icon: Video, label: "Upload Video", href: "/videos", color: "bg-success" },
    { icon: PenTool, label: "Whiteboard", href: "/whiteboard", color: "bg-warning" },
  ];

  const statCards = [
    { icon: Users, label: "Teams", value: stats.teams, color: "text-primary" },
    { icon: BookOpen, label: "Playbooks", value: stats.playbooks, color: "text-secondary" },
    { icon: PlayCircle, label: "Plays", value: stats.plays, color: "text-success" },
    { icon: Video, label: "Videos", value: stats.videos, color: "text-warning" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {profile?.full_name || "Coach"} 👋
        </h1>
        <p className="text-muted-foreground">Here's what's happening with your team today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.href}>
                <Button
                  variant="outline"
                  className="w-full h-auto py-6 flex flex-col items-center gap-3 hover:shadow-md transition-all"
                >
                  <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center`}>
                    <action.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      {stats.teams === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Get Started</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first team to start building playbooks, uploading videos, and using AI coaching tools.
                </p>
                <Link to="/team">
                  <Button className="gradient-primary group">
                    Create Your Team
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
