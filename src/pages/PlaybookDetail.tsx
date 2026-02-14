import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, PlayCircle, Loader2, Trash2, Library, BookTemplate, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function PlaybookDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playbook, setPlaybook] = useState<any>(null);
  const [plays, setPlays] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [form, setForm] = useState({ name: "", description: "", type: "offense", difficulty: "intermediate" });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    const [pbRes, playsRes, tmplRes] = await Promise.all([
      supabase.from("playbooks").select("*, teams(name)").eq("id", id).single(),
      supabase.from("plays").select("*").eq("playbook_id", id).order("created_at", { ascending: false }),
      supabase.from("play_templates").select("*").order("name"),
    ]);
    setPlaybook(pbRes.data);
    setPlays(playsRes.data || []);
    setTemplates(tmplRes.data || []);
    setLoading(false);
  };

  const addFromTemplate = async (template: any) => {
    if (!user || !id) return;
    setAddingTemplate(template.id);
    const { error } = await supabase.from("plays").insert({
      playbook_id: id,
      name: template.name,
      description: template.description || null,
      type: template.type,
      difficulty: template.difficulty,
      players_data: template.players_data,
      actions_data: template.actions_data,
      canvas_data: template.canvas_data,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`"${template.name}" added to playbook!`);
      fetchData();
    }
    setAddingTemplate(null);
  };

  const filteredTemplates = templates.filter(
    (t) => templateFilter === "all" || t.type === templateFilter
  );

  const createPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim() || !id) return;
    setCreating(true);
    const { error } = await supabase.from("plays").insert({
      playbook_id: id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      difficulty: form.difficulty,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Play created!");
      setForm({ name: "", description: "", type: "offense", difficulty: "intermediate" });
      setDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  const deletePlay = async (playId: string) => {
    const { error } = await supabase.from("plays").delete().eq("id", playId);
    if (error) toast.error(error.message);
    else {
      toast.success("Play deleted");
      fetchData();
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!playbook) return <div className="p-8 text-center text-muted-foreground">Playbook not found</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <Link to="/playbooks" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Playbooks
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{playbook.name}</h1>
          <p className="text-muted-foreground">{playbook.description || playbook.teams?.name}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Library className="w-4 h-4 mr-2" /> Browse Templates</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader><DialogTitle>Play Templates</DialogTitle></DialogHeader>
              <div className="flex gap-2 flex-wrap mb-4">
                {["all", "offense", "defense", "press_break", "out_of_bounds"].map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={templateFilter === f ? "default" : "outline"}
                    onClick={() => setTemplateFilter(f)}
                    className="capitalize"
                  >
                    {f === "all" ? "All" : f.replace("_", " ")}
                  </Button>
                ))}
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {filteredTemplates.map((t) => (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <PlayCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{t.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                          <div className="flex gap-1.5 mt-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">{t.type?.replace("_", " ")}</Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{t.difficulty}</Badge>
                            {t.category && <Badge variant="outline" className="text-[10px] capitalize">{t.category?.replace("_", " ")}</Badge>}
                          </div>
                          {t.coaching_notes && (
                            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary/20 pl-2">{t.coaching_notes}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addFromTemplate(t)}
                          disabled={addingTemplate === t.id}
                          className="shrink-0"
                        >
                          {addingTemplate === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          <span className="ml-1">Add</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No templates in this category</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" /> Add Play</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Play</DialogTitle></DialogHeader>
              <form onSubmit={createPlay} className="space-y-4">
                <div className="space-y-2">
                  <Label>Play Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offense">Offense</SelectItem>
                        <SelectItem value="defense">Defense</SelectItem>
                        <SelectItem value="special">Special</SelectItem>
                        <SelectItem value="press_break">Press Break</SelectItem>
                        <SelectItem value="out_of_bounds">Out of Bounds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary" disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Add Play
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {plays.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <PlayCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No plays yet</h3>
            <p className="text-muted-foreground">Add your first play to this playbook</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plays.map((play) => (
            <Card
              key={play.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/create?playId=${play.id}`)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{play.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full capitalize">{play.type}</span>
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full capitalize">{play.difficulty}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); deletePlay(play.id); }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
