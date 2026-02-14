import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, PlayCircle, Video, Users, Plus, ArrowRight,
  PenTool, Upload, Target, UserCheck,
  Calendar, MessageSquare, Send
} from "lucide-react";

interface PlaybookRow {
  id: string;
  name: string;
  created_at: string;
  plays: { id: string }[];
}

interface TeamMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  team_id: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ teams: 0, playbooks: 0, plays: 0, videos: 0, members: 0 });
  const [recentPlaybooks, setRecentPlaybooks] = useState<PlaybookRow[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [teams, playbooks, plays, videos, members, recentPb] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact" }),
        supabase.from("playbooks").select("id", { count: "exact", head: true }),
        supabase.from("plays").select("id", { count: "exact", head: true }),
        supabase.from("videos").select("id", { count: "exact", head: true }),
        supabase.from("team_memberships").select("id", { count: "exact", head: true }),
        supabase.from("playbooks").select("id, name, created_at, plays(id)").order("created_at", { ascending: false }).limit(4),
      ]);

      const firstTeamId = teams.data?.[0]?.id || null;
      setTeamId(firstTeamId);

      setStats({
        teams: teams.count || 0,
        playbooks: playbooks.count || 0,
        plays: plays.count || 0,
        videos: videos.count || 0,
        members: members.count || 0,
      });
      setRecentPlaybooks((recentPb.data as unknown as PlaybookRow[]) || []);

      if (firstTeamId) {
        const { data: msgs } = await supabase
          .from("team_messages")
          .select("id, content, created_at, sender_id, team_id, profiles:sender_id(full_name, avatar_url)")
          .eq("team_id", firstTeamId)
          .order("created_at", { ascending: true })
          .limit(20);
        setMessages((msgs as unknown as TeamMessage[]) || []);
      }
    };
    fetchData();
  }, [user]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel("team-messages-" + teamId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const { data } = await supabase
            .from("team_messages")
            .select("id, content, created_at, sender_id, team_id, profiles:sender_id(full_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setMessages((prev) => [...prev, data as unknown as TeamMessage]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !teamId || !user) return;
    setSendingMessage(true);
    await supabase.from("team_messages").insert({
      team_id: teamId,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSendingMessage(false);
  };

  const statCards = [
    { icon: Target, label: "Total Plays", value: stats.plays },
    { icon: BookOpen, label: "Playbooks", value: stats.playbooks },
    { icon: Video, label: "Videos", value: stats.videos },
    { icon: UserCheck, label: "Active Players", value: stats.members },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold mb-1">
          Welcome back, {profile?.full_name || "Coach"} 👋
        </h1>
        <p className="text-muted-foreground text-sm">Here's your team overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <stat.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{stat.label}</span>
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Recent Playbooks + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Playbooks - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">Recent Playbooks</CardTitle>
              <p className="text-sm text-muted-foreground">Your latest created playbooks</p>
            </div>
            <div className="flex gap-2">
              <Link to="/playbooks">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
              <Link to="/playbooks">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  New Playbook
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPlaybooks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No playbooks yet</p>
                <Link to="/playbooks">
                  <Button variant="link" size="sm" className="mt-1">Create your first playbook →</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentPlaybooks.map((pb) => (
                  <Link
                    key={pb.id}
                    to={`/playbooks/${pb.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <PlayCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{pb.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pb.plays?.length || 0} plays · {new Date(pb.created_at).getFullYear()}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Upcoming Games placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upcoming Games</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No upcoming games scheduled</p>
              </div>
            </CardContent>
          </Card>

          {/* Team Roster */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-lg">Team Roster</CardTitle>
              <Link to="/team">
                <Button variant="link" size="sm" className="text-primary p-0 h-auto">Manage</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats.members === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No team members yet</p>
                  <Link to="/team">
                    <Button variant="link" size="sm" className="mt-1">Add players →</Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">{stats.members} team member{stats.members !== 1 ? "s" : ""}</p>
                  <Link to="/team">
                    <Button variant="link" size="sm">View roster →</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Video Library + Team Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Library */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Video Library</CardTitle>
            <Link to="/videos">
              <Button variant="ghost" size="sm">
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.videos === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No videos uploaded yet</p>
                <Link to="/videos">
                  <Button variant="link" size="sm" className="mt-1">Upload your first video →</Button>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">{stats.videos} video{stats.videos !== 1 ? "s" : ""} in library</p>
                <Link to="/videos">
                  <Button variant="link" size="sm" className="p-0 h-auto mt-1">View all videos →</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Messages */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Team Messages</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {!teamId ? (
              <div className="text-center py-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Create a team to start messaging</p>
                <Link to="/team">
                  <Button variant="link" size="sm" className="mt-1">Create team →</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 max-h-52 overflow-y-auto space-y-3 mb-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs mt-1">Send your first message</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {!isOwn && (
                              <p className="text-xs font-medium mb-0.5 opacity-70">
                                {msg.profiles?.full_name || "Unknown"}
                              </p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button size="icon" onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
