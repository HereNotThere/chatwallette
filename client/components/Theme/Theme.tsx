const ColorValues = {
  BlackPurple: "#180b20",
  XDarkPurple: "#200e2c",
  DarkPurple: "#412055",
  GrapePurple: "#491f62",
  LightPurple: "#cb9ee5",
  Pink: "#ff00c2",
  NeonPurple: "#cf47ff",
  Turqoise: "#00edff",
  Yellow: "#fee501",
  White: "#fff",
} as const;

export type ColorAttr = keyof typeof ColorValues;

enum ColorNames {
  BlackPurple = "BlackPurple",
  XDarkPurple = "XDarkPurple",
  DarkPurple = "DarkPurple",
  LightPurple = "LightPurple",
  GrapePurple = "GrapePurple",
  Pink = "Pink",
  NeonPurple = "NeonPurple",
  Turqoise = "Turqoise",
  Yellow = "Yellow",
  White = "White",
}

const Backgrounds = {
  body: ColorNames.BlackPurple,
  panel: ColorNames.XDarkPurple,
  panel2: ColorNames.LightPurple,
  input: ColorNames.DarkPurple,
  button: ColorNames.NeonPurple,
} as const;

export type BackgroundAttr = keyof typeof Backgrounds;

const Foregrounds = {
  body: ColorNames.White,
  muted: ColorNames.LightPurple,
  primary: ColorNames.Turqoise,
  inverted: Backgrounds.body,
} as const;

export type ForegroundAttr = keyof typeof Foregrounds;

const Baseline = 10;

export const Theme = {
  Baseline,
  ColorValues: ColorValues,
  ColorNames,
  Backgrounds,
  Foregrounds,
};
