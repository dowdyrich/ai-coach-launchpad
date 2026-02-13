import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Playbooks() {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", team_id: "", category: "offense" });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [pbRes, teamRes] = await Promise.all([
      supabase.from("playbooks").select("*, teams(name)").order("updated_at", { ascending: false }),
      supabase.from("teams").select("id, name"),
    ]);
    setPlaybooks(pbRes.data || []);
    setTeams(teamRes.data || []);
    setLoading(false);
  };

  const createPlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim() || !form.team_id) return;
    setCreating(true);
    const { error } = await supabase.from("playbooks").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      team_id: form.team_id,
      category: form.category,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Playbook created!");
      setForm({ name: "", description: "", team_id: "", category: "offense" });
      setDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  const filtered = playbooks.filter((pb) =>
    pb.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Playbooks</h1>
          <p className="text-muted-foreground">Organize your plays into strategic collections</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary" disabled={teams.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> New Playbook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Playbook</DialogTitle>
            </DialogHeader>
            <form onSubmit={createPlaybook} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offense">Offense</SelectItem>
                    <SelectItem value="defense">Defense</SelectItem>
                    <SelectItem value="special">Special Situations</SelectItem>
                    <SelectItem value="transition">Transition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={creating || !form.team_id}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Playbook
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search playbooks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : teams.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create a team first</h3>
            <p className="text-muted-foreground mb-4">You need at least one team to create playbooks</p>
            <Link to="/team"><Button className="gradient-primary">Create Team</Button></Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No playbooks found</h3>
            <p className="text-muted-foreground">Create your first playbook to organize your plays</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pb) => (
            <Link key={pb.id} to={`/playbooks/${pb.id}`}>
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">{pb.category}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{pb.name}</h3>
                  {pb.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{pb.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{pb.teams?.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
