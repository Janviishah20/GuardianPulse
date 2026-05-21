# Design Brief

## Direction

SafeEscape AI — Emergency operations center interface for real-time threat detection, floor plan heat mapping, and evacuation routing.

## Tone

Brutalist utilitarian: deep navy-black backgrounds, aggressive high-contrast color system (bright red/amber/green), no decorative shadows. Authority through clarity, not elegance.

## Differentiation

Immediate visual threat perception: color-coded heat maps (red=critical, amber=secondary, green=safe) with pulsing alert indicators create instant situational awareness for emergency responders.

## Color Palette

| Token      | OKLCH           | Role                          |
| ---------- | --------------- | ----------------------------- |
| background | 0.08 0.01 260   | Deep navy-black (emergency base) |
| foreground | 0.94 0.01 260   | High-contrast light text       |
| card       | 0.12 0.015 260  | Slightly elevated surface      |
| primary    | 0.55 0.22 25    | Critical threat (bright red)   |
| secondary  | 0.72 0.18 75    | Warning zone (amber/orange)    |
| muted      | 0.18 0.015 260  | Disabled/secondary states      |
| accent     | 0.72 0.18 75    | Amber highlight (warning)      |
| destructive| 0.55 0.22 25    | Same as primary (red alert)    |
| chart-3    | 0.65 0.18 145   | Safe zone (green)              |

## Typography

- Display: Space Grotesk — bold, technical, military aesthetic for headings and threat labels
- Body: DM Sans — clean, legible under stress for descriptions and UI text
- Mono: Geist Mono — technical readings, timestamps, coordinates
- Scale: Hero `text-4xl font-bold tracking-tight`, Sections `text-xl font-semibold`, Labels `text-xs font-bold uppercase tracking-widest`, Body `text-sm`

## Elevation & Depth

Single flat plane with border-based hierarchy: no shadows, minimal radii (0-2px), borders define container edges. Alert states pulse at 2s interval.

## Structural Zones

| Zone     | Background        | Border              | Notes                                   |
| -------- | ----------------- | ------------------- | --------------------------------------- |
| Header   | bg-card           | border-b border-border | Minimal top bar with nav/title           |
| Threat   | bg-background     | border-emergency    | Upload + Gemini classification display  |
| Floor    | bg-background     | border-emergency    | SVG heat map, room-based coloring        |
| Routing  | bg-background     | border-emergency    | A* path visualization + TTS playback     |
| Manifest | bg-background     | border-emergency    | Table: room, floor, threat, timestamp   |
| Footer   | bg-card           | border-t border-border | Status bar with system clock             |

## Spacing & Rhythm

Compact 1rem gaps between sections, 0.5rem micro-spacing within cards. Content areas use 1.5rem padding. Table rows compact at 0.75rem row-height.

## Component Patterns

- Buttons: Minimal border, all-caps labels, hover opacity change (no color shift)
- Cards: Sharp 0-2px corners, thin borders, flat background (no shadow)
- Badges: Emergency-badge utility — critical (red bg), warning (amber bg), safe (green bg)
- Heat Map: SVG room elements with .heat-map-{critical|warning|safe} classes

## Motion

- Entrance: No animation, instant display (emergency context)
- Hover: Opacity 0.8 → 1.0 transition, 200ms
- Alert: Pulsing (2s cycle) for critical threats via .alert-pulse

## Constraints

- No gradients, no shadows, no decorative blur
- High contrast on all text: min 12:1 ratio for critical zones
- Emergency color system only (red/amber/green), no secondary palette colors in heat maps
- Timestamps and coordinates in monospace for precision readability

## Signature Detail

Pulsing heat map elements: critical threat rooms flash at 2s interval, creating immediate visual urgency without audio cues. SVG-rendered floor plan responds to real-time threat classification.
