import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  CalendarIcon, Plus, MapPin, Clock, ArrowLeft, Trash2, Edit2, Trophy
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Game {
  id: string;
  team_id: string;
  opponent: string;
  game_date: string;
  location: string | null;
  notes: string | null;
  result: string | null;
  team_score: number | null;
  opponent_score: number | null;
}

export default function Schedule() {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // Form state
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState<Date>();
  const [gameTime, setGameTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<string>("");
  const [teamScore, setTeamScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");

  const fetchGames = async (tid: string) => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("team_id", tid)
      .order("game_date", { ascending: true });
    setGames((data as Game[]) || []);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("teams").select("id").limit(1).then(({ data }) => {
      const tid = data?.[0]?.id || null;
      setTeamId(tid);
      if (tid) fetchGames(tid);
    });
  }, [user]);

  const resetForm = () => {
    setOpponent("");
    setGameDate(undefined);
    setGameTime("19:00");
    setLocation("");
    setNotes("");
    setResult("");
    setTeamScore("");
    setOpponentScore("");
    setEditingGame(null);
  };

  const openEdit = (game: Game) => {
    setEditingGame(game);
    setOpponent(game.opponent);
    setGameDate(new Date(game.game_date));
    setGameTime(format(new Date(game.game_date), "HH:mm"));
    setLocation(game.location || "");
    setNotes(game.notes || "");
    setResult(game.result || "");
    setTeamScore(game.team_score?.toString() || "");
    setOpponentScore(game.opponent_score?.toString() || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!opponent.trim() || !gameDate || !teamId || !user) return;

    const [hours, minutes] = gameTime.split(":").map(Number);
    const fullDate = new Date(gameDate);
    fullDate.setHours(hours, minutes, 0, 0);

    const payload = {
      team_id: teamId,
      opponent: opponent.trim(),
      game_date: fullDate.toISOString(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      result: result || null,
      team_score: teamScore ? parseInt(teamScore) : null,
      opponent_score: opponentScore ? parseInt(opponentScore) : null,
    };

    if (editingGame) {
      const { error } = await supabase.from("games").update(payload).eq("id", editingGame.id);
      if (error) { toast.error("Failed to update game"); return; }
      toast.success("Game updated");
    } else {
      const { error } = await supabase.from("games").insert({ ...payload, created_by: user.id });
      if (error) { toast.error("Failed to schedule game"); return; }
      toast.success("Game scheduled");
    }

    setDialogOpen(false);
    resetForm();
    fetchGames(teamId);
  };

  const handleDelete = async (id: string) => {
    if (!teamId) return;
    await supabase.from("games").delete().eq("id", id);
    toast.success("Game deleted");
    fetchGames(teamId);
  };

  const now = new Date();
  const upcoming = games.filter((g) => new Date(g.game_date) >= now);
  const past = games.filter((g) => new Date(g.game_date) < now).reverse();

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Game Schedule</h1>
            <p className="text-sm text-muted-foreground">Manage your team's upcoming and past games</p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button disabled={!teamId}><Plus className="w-4 h-4 mr-1" /> Schedule Game</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGame ? "Edit Game" : "Schedule Game"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Opponent *</Label>
                <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Eagles" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !gameDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {gameDate ? format(gameDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={gameDate} onSelect={setGameDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={gameTime} onChange={(e) => setGameTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Home Court" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about the game..." rows={2} />
              </div>

              {/* Result section (for editing past games) */}
              {editingGame && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-semibold">Game Result</Label>
                  <Select value={result} onValueChange={setResult}>
                    <SelectTrigger><SelectValue placeholder="Select result" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="win">Win</SelectItem>
                      <SelectItem value="loss">Loss</SelectItem>
                      <SelectItem value="draw">Draw</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Your Score</Label>
                      <Input type="number" value={teamScore} onChange={(e) => setTeamScore(e.target.value)} />
                    </div>
                    <div>
                      <Label>Opponent Score</Label>
                      <Input type="number" value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleSave} disabled={!opponent.trim() || !gameDate}>
                {editingGame ? "Update Game" : "Schedule Game"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!teamId && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>Create a team first to schedule games.</p>
            <Link to="/team"><Button variant="link">Create team →</Button></Link>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Games */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Games ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No upcoming games scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((game) => (
                <div key={game.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[50px]">
                      <p className="text-xs text-muted-foreground">{format(new Date(game.game_date), "MMM")}</p>
                      <p className="text-xl font-bold">{format(new Date(game.game_date), "d")}</p>
                    </div>
                    <div>
                      <p className="font-medium">vs {game.opponent}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(game.game_date), "h:mm a")}</span>
                        {game.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{game.location}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(game)}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(game.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Games */}
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Past Games ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {past.map((game) => (
                <div key={game.id} className="flex items-center justify-between p-4 rounded-lg border opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[50px]">
                      <p className="text-xs text-muted-foreground">{format(new Date(game.game_date), "MMM")}</p>
                      <p className="text-xl font-bold">{format(new Date(game.game_date), "d")}</p>
                    </div>
                    <div>
                      <p className="font-medium">vs {game.opponent}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {game.result && (
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            game.result === "win" ? "bg-green-100 text-green-700" : game.result === "loss" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
                          )}>
                            {game.result.charAt(0).toUpperCase() + game.result.slice(1)}
                            {game.team_score != null && game.opponent_score != null && ` ${game.team_score}-${game.opponent_score}`}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{format(new Date(game.game_date), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(game)}><Edit2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
