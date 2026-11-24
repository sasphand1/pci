import { useId } from "react";

type IconProps = { className?: string; title?: string };

export function YouTubeIcon({ className, title = "YouTube" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      <rect x="0.5" y="3.5" width="23" height="17" rx="5" fill="#FF0000" />
      <path d="M9.6 8.4v7.2l6.2-3.6z" fill="#FFFFFF" />
    </svg>
  );
}

export function InstagramIcon({ className, title = "Instagram" }: IconProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`ig${id}`} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA77" />
          <stop offset="0.25" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="0.75" stopColor="#8134AF" />
          <stop offset="1" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill={`url(#ig${id})`} />
      <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
      <circle cx="16.4" cy="7.6" r="1" fill="#FFFFFF" />
    </svg>
  );
}

const NOTE = "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
export function TikTokIcon({ className, title = "TikTok" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      <path d={NOTE} fill="#25F4EE" transform="translate(-0.7 0.6) scale(0.96) translate(0.5 0.5)" />
      <path d={NOTE} fill="#FE2C55" transform="translate(0.7 -0.4) scale(0.96) translate(0.5 0.5)" />
      <path d={NOTE} fill="#000000" transform="scale(0.96) translate(0.5 0.5)" />
    </svg>
  );
}

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "youtube") return <YouTubeIcon className={className} />;
  if (platform === "instagram") return <InstagramIcon className={className} />;
  if (platform === "tiktok") return <TikTokIcon className={className} />;
  return null;
}
