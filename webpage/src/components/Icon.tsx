/** Simple 24×24 line icons drawn for this site (stroke = currentColor). Decorative unless given a label. */
const PATHS = {
  github:
    'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  tabs: 'M3 8h18v12H3zM3 8l2-4h6l2 4M13 8l1.5-3h5L21 8',
  reader: 'M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-5a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h5zM6.5 9h3M6.5 12h3M15.5 9h2.5M15.5 12h2.5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  audio: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  incognito: 'M3 11h18M6 11l1.5-6h9L18 11M7 18a3 3 0 1 0 0-.1zM17 18a3 3 0 1 0 0-.1zM10 17.5c1.3-.7 2.7-.7 4 0',
  backup: 'M12 3v10M8 9l4 4 4-4M5 15v4h14v-4M9 18h6',
  bookmark: 'M6 3h12v18l-6-4-6 4zM9.5 8h5',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  key: 'M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2 4.5 4.5 0 0 1 1.3 3.2zM13.2 12.8 21 20.5M17.5 17l2-2M15.5 15l1.5-1.5',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  hand: 'M12 3v8M9 5v7M15 5v7M6 9v5a6 6 0 0 0 12 0V8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  partial: 'M12 4a8 8 0 1 0 0 16zM12 4a8 8 0 1 1 0 16',
  no: 'M7 7l10 10M17 7 7 17',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  dash: 'M8 12h8',
  compare: 'M4 4h6v16H4zM14 4h6v16h-6zM6.5 8h1M16.5 8h1M6.5 12h1M16.5 12h1',
  cart: 'M3 4h2l2.5 11h10L20 7H6.2M9 20h.01M17 20h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  research: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5M8 11h6M11 8v6',
  call: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.2-1.6-.4-1 .3-2.4 1.6-2.4H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01',
  cookie: 'M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3zM8.5 11h.01M12 15.5h.01M16 14.5h.01M8.5 16h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
