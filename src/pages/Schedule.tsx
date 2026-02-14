import { useEffect, useState, useRef } from "react";
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
  CalendarIcon, Plus, MapPin, Clock, ArrowLeft, Trash2, Edit2, Upload, FileSpreadsheet
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

interface CsvRow {
  opponent: string;
  date: string;
  time: string;
  location: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim());

  const opponentIdx = headers.findIndex((h) => h.includes("opponent") || h.includes("team"));
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const timeIdx = headers.findIndex((h) => h.includes("time"));
  const locationIdx = headers.findIndex((h) => h.includes("location") || h.includes("venue"));

  if (opponentIdx === -1 || dateIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const opponent = cols[opponentIdx] || "";
    const date = cols[dateIdx] || "";
    if (!opponent || !date) continue;
    if (opponent.length > 200) continue; // length guard

    rows.push({
      opponent: opponent.slice(0, 200),
      date,
      time: timeIdx >= 0 ? (cols[timeIdx] || "19:00") : "19:00",
      location: locationIdx >= 0 ? (cols[locationIdx] || "").slice(0, 200) : "",
    });
  }
  return rows;
}

function parseGameDate(dateStr: string, timeStr: string): Date | null {
  try {
    // Try various date formats
    let d: Date | null = null;
    // ISO or standard
    d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Try MM/DD/YYYY
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        const [a, b, c] = parts.map(Number);
        if (a > 31) d = new Date(a, b - 1, c); // YYYY-MM-DD
        else d = new Date(c < 100 ? c + 2000 : c, a - 1, b); // MM/DD/YYYY
      }
    }
    if (!d || isNaN(d.getTime())) return null;

    // Parse time
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1]);
      const mins = parseInt(timeParts[2]);
      const ampm = timeParts[3]?.toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      d.setHours(hours, mins, 0, 0);
    } else {
      d.setHours(19, 0, 0, 0);
    }
    return d;
  } catch {
    return null;
  }
}

export default function Schedule() {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setOpponent(""); setGameDate(undefined); setGameTime("19:00");
    setLocation(""); setNotes(""); setResult("");
    setTeamScore(""); setOpponentScore(""); setEditingGame(null);
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
      opponent: opponent.trim().slice(0, 200),
      game_date: fullDate.toISOString(),
      location: location.trim().slice(0, 200) || null,
      notes: notes.trim().slice(0, 500) || null,
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

  // CSV Import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error("File too large (max 1MB)"); return; }
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file"); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("No valid rows found. CSV needs 'opponent' and 'date' columns.");
        return;
      }
      if (rows.length > 100) {
        toast.error("Max 100 games per import");
        return;
      }
      setCsvPreview(rows);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCsvImport = async () => {
    if (!teamId || !user || csvPreview.length === 0) return;
    setImporting(true);

    const inserts = csvPreview
      .map((row) => {
        const d = parseGameDate(row.date, row.time);
        if (!d) return null;
        return {
          team_id: teamId,
          opponent: row.opponent,
          game_date: d.toISOString(),
          location: row.location || null,
          created_by: user.id,
        };
      })
      .filter(Boolean);

    if (inserts.length === 0) {
      toast.error("No valid dates found in CSV");
      setImporting(false);
      return;
    }

    const { error } = await supabase.from("games").insert(inserts as any[]);
    if (error) {
      toast.error("Failed to import games");
    } else {
      toast.success(`${inserts.length} game${inserts.length > 1 ? "s" : ""} imported!`);
      setCsvDialogOpen(false);
      setCsvPreview([]);
      fetchGames(teamId);
    }
    setImporting(false);
  };

  const now = new Date();
  const upcoming = games.filter((g) => new Date(g.game_date) >= now);
  const past = games.filter((g) => new Date(g.game_date) < now).reverse();

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Game Schedule</h1>
            <p className="text-sm text-muted-foreground">Manage your team's upcoming and past games</p>
          </div>
        </div>

        <div className="flex gap-2">
          {/* CSV Import */}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" disabled={!teamId} onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </Button>

          {/* Schedule Game Dialog */}
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
                  <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Eagles" maxLength={200} />
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
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Home Court" maxLength={200} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about the game..." rows={2} maxLength={500} />
                </div>
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
      </div>

      {/* CSV Preview Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(o) => { setCsvDialogOpen(o); if (!o) setCsvPreview([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" /> Import Preview
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{csvPreview.length} game{csvPreview.length !== 1 ? "s" : ""} found in CSV</p>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Opponent</th>
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Time</th>
                  <th className="text-left p-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.opponent}</td>
                    <td className="p-2">{row.date}</td>
                    <td className="p-2">{row.time}</td>
                    <td className="p-2">{row.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvPreview([]); }}>Cancel</Button>
            <Button onClick={handleCsvImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${csvPreview.length} Games`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                            game.result === "win" ? "bg-accent/20 text-accent-foreground" : game.result === "loss" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
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
