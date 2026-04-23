import { SVGProps } from "react";

export function FloraIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      {/* Petals */}
      <circle cx="12" cy="6" r="3" fill="currentColor" opacity={0.85} />
      <circle cx="17.2" cy="9.8" r="3" fill="currentColor" opacity={0.8} />
      <circle cx="15.2" cy="15.8" r="3" fill="currentColor" opacity={0.75} />
      <circle cx="8.8" cy="15.8" r="3" fill="currentColor" opacity={0.75} />
      <circle cx="6.8" cy="9.8" r="3" fill="currentColor" opacity={0.8} />
      {/* Center */}
      <circle cx="12" cy="11" r="2.8" fill="currentColor" opacity={1} />
    </svg>
  );
}
