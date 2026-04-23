import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Youtube, X, ExternalLink } from "lucide-react";

type PlayerType = "none" | "spotify" | "youtube";

interface MediaPlayerPanelProps {
  className?: string;
}

const SPOTIFY_PLAYLISTS = [
  { name: "Lo-Fi Study", uri: "37i9dQZF1DWWQRwui0ExPn" },
  { name: "Deep Focus", uri: "37i9dQZF1DWZeKCadgRdKQ" },
  { name: "Peaceful Piano", uri: "37i9dQZF1DX4sWSpwq3LiO" },
  { name: "Brain Food", uri: "37i9dQZF1DWXLeA8Omikj7" },
];

const YOUTUBE_CHANNELS = [
  { name: "Lo-Fi Girl", videoId: "jfKfPfyJRdk" },
  { name: "Café Jazz", videoId: "h2zkV-l_TbY" },
  { name: "Rain & Jazz", videoId: "DSGyEsJ17cI" },
  { name: "Study Ambience", videoId: "sGkh1W5cbH4" },
];

export function MediaPlayerPanel({ className }: MediaPlayerPanelProps) {
  const [activePlayer, setActivePlayer] = useState<PlayerType>("none");
  const [spotifyUri, setSpotifyUri] = useState(SPOTIFY_PLAYLISTS[0].uri);
  const [youtubeId, setYoutubeId] = useState(YOUTUBE_CHANNELS[0].videoId);
  const [customUrl, setCustomUrl] = useState("");

  const parseSpotifyUrl = (url: string): string | null => {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const parseYoutubeUrl = (url: string): string | null => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleCustomUrl = () => {
    if (!customUrl.trim()) return;
    const spotifyId = parseSpotifyUrl(customUrl);
    if (spotifyId) {
      setSpotifyUri(spotifyId);
      setActivePlayer("spotify");
      setCustomUrl("");
      return;
    }
    const ytId = parseYoutubeUrl(customUrl);
    if (ytId) {
      setYoutubeId(ytId);
      setActivePlayer("youtube");
      setCustomUrl("");
      return;
    }
  };

  return (
    <div className={`rounded-2xl border border-border/70 bg-card/85 p-4 space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm">Player de Estudo</h3>
        </div>
        {activePlayer !== "none" && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActivePlayer("none")}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Player selector */}
      <div className="flex gap-2">
        <Button
          variant={activePlayer === "spotify" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setActivePlayer("spotify")}
        >
          <Music className="w-3.5 h-3.5" /> Spotify
        </Button>
        <Button
          variant={activePlayer === "youtube" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setActivePlayer("youtube")}
        >
          <Youtube className="w-3.5 h-3.5" /> YouTube
        </Button>
      </div>

      {/* Custom URL */}
      <div className="flex gap-2">
        <Input
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="Cole URL do Spotify ou YouTube..."
          className="text-xs h-8"
          onKeyDown={(e) => e.key === "Enter" && handleCustomUrl()}
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleCustomUrl} disabled={!customUrl.trim()}>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Spotify Player */}
      {activePlayer === "spotify" && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {SPOTIFY_PLAYLISTS.map((pl) => (
              <button
                key={pl.uri}
                onClick={() => setSpotifyUri(pl.uri)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  spotifyUri === pl.uri ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {pl.name}
              </button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden">
            <iframe
              src={`https://open.spotify.com/embed/playlist/${spotifyUri}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {/* YouTube Player */}
      {activePlayer === "youtube" && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {YOUTUBE_CHANNELS.map((ch) => (
              <button
                key={ch.videoId}
                onClick={() => setYoutubeId(ch.videoId)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  youtubeId === ch.videoId ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {ch.name}
              </button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {activePlayer === "none" && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Escolha Spotify ou YouTube para ouvir enquanto estuda
        </p>
      )}
    </div>
  );
}
