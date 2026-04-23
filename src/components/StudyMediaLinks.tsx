import { Music, Youtube } from "lucide-react";

export function StudyMediaLinks({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <a
        href="https://open.spotify.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 text-sm"
        aria-label="Abrir Spotify"
      >
        <Music className="w-4 h-4 text-[hsl(141,73%,42%)]" />
        <span>Spotify</span>
      </a>
      <a
        href="https://www.youtube.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 text-sm"
        aria-label="Abrir YouTube"
      >
        <Youtube className="w-4 h-4 text-[hsl(0,100%,50%)]" />
        <span>YouTube</span>
      </a>
    </div>
  );
}
