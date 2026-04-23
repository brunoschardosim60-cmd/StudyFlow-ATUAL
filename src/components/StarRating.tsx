import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
}

export function StarRating({ rating, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)} className="focus:outline-none transition-transform hover:scale-110">
          <Star
            className={`w-4 h-4 ${star <= rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}
