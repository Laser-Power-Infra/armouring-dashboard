// Small line icons for block headers (SF Symbols style, drawn inline: no icon dependency).

const paths = {
  // cable drum: two flanges and a barrel
  drum: "M6 4v16M18 4v16M6 8h12M6 16h12M6 12h12",
  layers: "M12 4 3 8.5 12 13l9-4.5L12 4ZM3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5",
  twist: "M4 8c4 0 4 8 8 8s4-8 8-8M4 16c4 0 4-8 8-8s4 8 8 8",
  core: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  shield: "M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z",
  chart: "M5 20V11M10 20V5M15 20v-7M20 20V9",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.9 3 2.9 3 5.5",
  spool: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
} as const;

export type GlyphName = keyof typeof paths;

export function Glyph({ name, size = 18 }: { name: GlyphName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
