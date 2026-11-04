export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5e7e" />
          <stop offset="1" stopColor="#ff9f5a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" opacity=".95" />
      <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" opacity=".6" />
    </svg>
  );
}

export function Icon({ name, size = 20 }: { name: "play" | "pause" | "plus" | "check" | "next" | "prev" | "list" | "share" | "close" | "trash" | "download" | "sparkle" | "search" | "route"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true as const };
  switch (name) {
    case "play":
      return (
        <svg {...p}>
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
      );
    case "pause":
      return (
        <svg {...p}>
          <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" />
          <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" />
        </svg>
      );
    case "next":
      return (
        <svg {...p}>
          <path d="M5 6.2v11.6a.9.9 0 0 0 1.4.75l8-5.8a.9.9 0 0 0 0-1.5l-8-5.8A.9.9 0 0 0 5 6.2ZM17 5.5h2v13h-2z" />
        </svg>
      );
    case "prev":
      return (
        <svg {...p}>
          <path d="M19 6.2v11.6a.9.9 0 0 1-1.4.75l-8-5.8a.9.9 0 0 1 0-1.5l8-5.8A.9.9 0 0 1 19 6.2ZM5 5.5h2v13H5z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="m9.5 16.6-4.1-4.1 1.4-1.4 2.7 2.7 7.7-7.7 1.4 1.4z" />
        </svg>
      );
    case "list":
      return (
        <svg {...p}>
          <path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h8v2H4zM18 14.5V6.2l3-.7v2l-1 .25V16a2.4 2.4 0 1 1-2-2.35Z" />
        </svg>
      );
    case "share":
      return (
        <svg {...p}>
          <path d="M12 3 7.5 7.5l1.4 1.4L11 6.8V15h2V6.8l2.1 2.1 1.4-1.4L12 3ZM5 11v9h14v-9h-2v7H7v-7z" />
        </svg>
      );
    case "close":
      return (
        <svg {...p}>
          <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M9 4h6l1 1.5h4V7H4V5.5h4zM6 8.5h12l-.8 11a1.5 1.5 0 0 1-1.5 1.4H8.3a1.5 1.5 0 0 1-1.5-1.4z" />
        </svg>
      );
    case "download":
      return (
        <svg {...p}>
          <path d="M11 4h2v8.2l2.6-2.6 1.4 1.4-5 5-5-5 1.4-1.4 2.6 2.6zM5 18h14v2H5z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...p}>
          <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <path d="M10.5 4a6.5 6.5 0 0 1 5.1 10.5l4.4 4.4-1.4 1.4-4.4-4.4A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
        </svg>
      );
    case "route":
      return (
        <svg {...p}>
          <path d="M6 3a3 3 0 0 1 .5 5.96V10a2 2 0 0 0 2 2h7a4 4 0 0 1 4 4v.04a3 3 0 1 1-2 0V16a2 2 0 0 0-2-2h-7a4 4 0 0 1-4-4V8.96A3 3 0 0 1 6 3Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
        </svg>
      );
    default:
      return null;
  }
}
