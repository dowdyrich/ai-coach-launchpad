import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Upload, Trash2, Play, Pause, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface VoiceOverlayEntry {
  id: string;
  stepIndex: number;
  audioUrl: string;
  storagePath: string;
  label: string;
  duration: number;
}

interface VoiceOverlayProps {
  overlays: VoiceOverlayEntry[];
  onOverlaysChange: (overlays: VoiceOverlayEntry[]) => void;
  currentStep: number;
  totalSteps: number;
}

export function VoiceOverlay({ overlays, onOverlaysChange, currentStep, totalSteps }: VoiceOverlayProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob, `recording-step-${currentStep}`);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied. Please allow microphone access.");
    }
  }, [currentStep]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file (MP3, WAV, etc.)");
      return;
    }
    await uploadAudio(file, file.name.replace(/\.[^.]+$/, ""));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentStep]);

  const uploadAudio = async (blob: Blob, label: string) => {
    setUploading(true);
    const id = crypto.randomUUID();
    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("wav") ? "wav" : "mp3";
    const path = `${id}.${ext}`;

    const { error } = await supabase.storage.from("voice-overlays").upload(path, blob, {
      contentType: blob.type,
    });

    if (error) {
      toast.error("Failed to upload audio: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("voice-overlays").getPublicUrl(path);

    // Get duration
    const duration = await getAudioDuration(blob);

    const newOverlay: VoiceOverlayEntry = {
      id,
      stepIndex: currentStep,
      audioUrl: urlData.publicUrl,
      storagePath: path,
      label: `Step ${currentStep + 1}: ${label}`,
      duration,
    };

    onOverlaysChange([...overlays, newOverlay]);
    toast.success("Voice overlay added!");
    setUploading(false);
  };

  const getAudioDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(blob);
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration));
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => resolve(0);
    });
  };

  const deleteOverlay = async (overlay: VoiceOverlayEntry) => {
    await supabase.storage.from("voice-overlays").remove([overlay.storagePath]);
    onOverlaysChange(overlays.filter(o => o.id !== overlay.id));
    toast.success("Voice overlay removed");
  };

  const togglePlay = (overlay: VoiceOverlayEntry) => {
    if (playingId === overlay.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Since bucket is private, we need a signed URL
    const getAndPlay = async () => {
      const { data, error } = await supabase.storage
        .from("voice-overlays")
        .createSignedUrl(overlay.storagePath, 300);

      if (error || !data?.signedUrl) {
        toast.error("Failed to load audio");
        return;
      }

      const audio = new Audio(data.signedUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(overlay.id);
    };

    getAndPlay();
  };

  const stepsArray = Array.from({ length: Math.max(totalSteps, 1) }, (_, i) => i);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Volume2 className="w-4 h-4" /> Voice Overlays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step indicator */}
        <div className="flex gap-1 flex-wrap">
          {stepsArray.map(i => {
            const hasOverlay = overlays.some(o => o.stepIndex === i);
            return (
              <Badge
                key={i}
                variant={i === currentStep ? "default" : "outline"}
                className={cn(
                  "text-[10px] cursor-default",
                  hasOverlay && i !== currentStep && "border-primary/50 bg-primary/10"
                )}
              >
                Step {i + 1}
                {hasOverlay && " 🎙️"}
              </Badge>
            );
          })}
        </div>

        {/* Record/Upload controls */}
        <div className="flex gap-2">
          {isRecording ? (
            <Button size="sm" variant="destructive" onClick={stopRecording} className="flex-1">
              <Square className="w-3 h-3 mr-1.5" /> Stop Recording
            </Button>
          ) : (
            <Button size="sm" onClick={startRecording} disabled={uploading} className="flex-1">
              <Mic className="w-3 h-3 mr-1.5" /> Record for Step {currentStep + 1}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isRecording}
          >
            <Upload className="w-3 h-3" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 text-xs text-destructive animate-pulse">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            Recording...
          </div>
        )}

        {/* Overlay list */}
        {overlays.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {overlays
              .sort((a, b) => a.stepIndex - b.stepIndex)
              .map((overlay) => (
              <div
                key={overlay.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md text-xs bg-muted/50",
                  overlay.stepIndex === currentStep && "ring-1 ring-primary/30"
                )}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => togglePlay(overlay)}
                >
                  {playingId === overlay.id ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
                <span className="flex-1 truncate">{overlay.label}</span>
                <span className="text-muted-foreground shrink-0">{overlay.duration}s</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-destructive"
                  onClick={() => deleteOverlay(overlay)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
