import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Search, Upload, Grid, List, Loader2, Play } from "lucide-react";

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchVideos();
  }, [user]);

  const fetchVideos = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("videos").select("*, teams(name)").order("created_at", { ascending: false });
    setVideos(data || []);
    setLoading(false);
  };

  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Video Library</h1>
          <p className="text-muted-foreground">Upload and organize coaching videos</p>
        </div>
        <Button className="gradient-primary">
          <Upload className="w-4 h-4 mr-2" /> Upload Video
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search videos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")}>
            <Grid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("list")}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
            <p className="text-muted-foreground">Upload your first coaching video</p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {filtered.map((video) => (
            <Card key={video.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className={viewMode === "grid" ? "p-0" : "p-4 flex items-center gap-4"}>
                <div className={cn(
                  "bg-muted flex items-center justify-center",
                  viewMode === "grid" ? "aspect-video rounded-t-lg" : "w-20 h-14 rounded-lg flex-shrink-0"
                )}>
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className={viewMode === "grid" ? "p-4" : "flex-1"}>
                  <h3 className="font-semibold truncate">{video.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.teams?.name} • {new Date(video.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
