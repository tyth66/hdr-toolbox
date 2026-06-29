import type { ThemePreference } from "./types";

const FALLBACK_ACCENT = "#339CFF";

export type FluentBrandRamp = Record<
  10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160,
  string
>;

export type FluentThemeLike = Record<string, unknown>;

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Hsl = {
  h: number;
  s: number;
  l: number;
};

export type EffectiveThemePreference = "light" | "dark";

export function resolveEffectiveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean
): EffectiveThemePreference {
  if (preference === "dark" || preference === "light") {
    return preference;
  }

  return systemPrefersDark ? "dark" : "light";
}

export function buildFluentBrandRamp(accentColor: string): FluentBrandRamp {
  const rgb = parseHexColor(accentColor) ?? parseHexColor(FALLBACK_ACCENT)!;
  const hsl = rgbToHsl(rgb);
  const lightSaturation = Math.max(0.75, hsl.s);

  return {
    10: hslToHex({ h: hsl.h, s: lightSaturation, l: 0.98 }),
    20: hslToHex({ h: hsl.h, s: lightSaturation, l: 0.94 }),
    30: hslToHex({ h: hsl.h, s: Math.max(0.68, hsl.s), l: 0.88 }),
    40: hslToHex({ h: hsl.h, s: Math.max(0.62, hsl.s), l: 0.78 }),
    50: hslToHex({ h: hsl.h, s: Math.max(0.58, hsl.s), l: 0.68 }),
    60: hslToHex({ h: hsl.h, s: Math.max(0.54, hsl.s), l: 0.58 }),
    70: hslToHex({ h: hsl.h, s: hsl.s, l: Math.min(0.5, hsl.l + 0.08) }),
    80: rgbToHex(rgb),
    90: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.34, hsl.l - 0.06) }),
    100: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.28, hsl.l - 0.12) }),
    110: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.24, hsl.l - 0.16) }),
    120: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.2, hsl.l - 0.2) }),
    130: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.17, hsl.l - 0.23) }),
    140: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.14, hsl.l - 0.26) }),
    150: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.12, hsl.l - 0.28) }),
    160: hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0.1, hsl.l - 0.3) }),
  };
}

export function createSystemAccentTheme<TTheme extends FluentThemeLike>(
  baseTheme: TTheme,
  accentColor: string
): TTheme {
  const brand = buildFluentBrandRamp(accentColor);
  return {
    ...baseTheme,
    colorBrandForeground1: brand[80],
    colorBrandForeground2: brand[90],
    colorBrandForegroundLink: brand[80],
    colorBrandForegroundLinkHover: brand[90],
    colorBrandForegroundLinkPressed: brand[100],
    colorBrandBackground: brand[80],
    colorBrandBackgroundHover: brand[90],
    colorBrandBackgroundPressed: brand[100],
    colorBrandBackgroundSelected: brand[80],
    colorBrandBackgroundInverted: brand[20],
    colorBrandBackgroundInvertedHover: brand[30],
    colorBrandStroke1: brand[80],
    colorBrandStroke2: brand[60],
    colorCompoundBrandForeground1: brand[80],
    colorCompoundBrandForeground1Hover: brand[90],
    colorCompoundBrandForeground1Pressed: brand[100],
    colorCompoundBrandStroke: brand[80],
    colorCompoundBrandStrokeHover: brand[90],
    colorCompoundBrandStrokePressed: brand[100],
  };
}

function parseHexColor(value: string): Rgb | null {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }

  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);

  let hue: number;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) {
    const channel = l * 255;
    return rgbToHex({ r: channel, g: channel, b: channel });
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - (l * s);
  const p = (2 * l) - q;

  return rgbToHex({
    r: hueToRgb(p, q, h + (1 / 3)) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - (1 / 3)) * 255,
  });
}

function hueToRgb(p: number, q: number, t: number): number {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + ((q - p) * 6 * hue);
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + ((q - p) * (2 / 3 - hue) * 6);
  return p;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
