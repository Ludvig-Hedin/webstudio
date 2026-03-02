import { createStitches } from "@stitches/react";
import type * as Stitches from "@stitches/react";
export type { VariantProps } from "@stitches/react";
import * as figma from "./__generated__/figma-design-tokens";

const spacing = {
  0: "0px",
  1: "1px",
  2: "2px",
  3: "4px",
  4: "6px",
  5: "8px",
  6: "10px",
  7: "12px",
  8: "14px",
  9: "16px",
  10: "20px",
  11: "24px",
  12: "28px",
  13: "32px",
  14: "36px",
  15: "40px",
  16: "44px",
  17: "48px",
  18: "56px",
  19: "64px",
  20: "80px",
  21: "96px",
  22: "112px",
  23: "128px",
  24: "144px",
  25: "160px",
  26: "176px",
  27: "192px",
  28: "208px",
  29: "224px",
  30: "240px",
  31: "256px",
  32: "288px",
  33: "320px",
  34: "384px",
  35: "448px",
};

const darkBlue = "#0A84FF";
const darkColors: Record<string, string> = { ...figma.color };

// Dynamically generate dark mode colors from the minimal light theme
Object.keys(darkColors).forEach((key) => {
  const k = key;
  const val = darkColors[k];

  if (val === "#007AFF") {
    darkColors[k] = darkBlue;
  } else if (
    val === "#FFFFFF" &&
    !k.includes("Contrast") &&
    !k.includes("white")
  ) {
    darkColors[k] = "#1E1E1E";
  } else if (
    val === "#000000" &&
    !k.includes("Button") &&
    !k.includes("black")
  ) {
    darkColors[k] = "#FFFFFF";
  } else if (val === "#1A1A1A") {
    if (k.includes("background")) {
      darkColors[k] = "#1A1A1A";
    } else {
      darkColors[k] = "#FFFFFF";
    }
  } else if (val === "#687076") {
    darkColors[k] = "#888888";
  } else if (val === "#C1C8CD") {
    darkColors[k] = "#555555";
  } else if (val === "#E5E5E5") {
    darkColors[k] = "#333333";
  } else if (val === "#EFEFEF") {
    darkColors[k] = "#2A2A2A";
  } else if (val === "#F5F5F5") {
    darkColors[k] = "#2C2C2C";
  } else if (val === "#EEEEEE") {
    darkColors[k] = "#111111";
  } else if (val === "#e0f0ff") {
    darkColors[k] = "#0C2E59";
  } // backgroundInfoNotification -> dark blue
  else if (val === "#fffbd1") {
    darkColors[k] = "#403A00";
  } // backgroundAlertNotification -> dark yellow
  else if (val === "#ffe9e9") {
    darkColors[k] = "#4A1515";
  } // backgroundDestructiveNotification -> dark red
  else if (val === "#e9f9ee") {
    darkColors[k] = "#0C3B24";
  } // backgroundSuccessNotification -> dark green
  else if (val.includes("linear-gradient(135deg, #007AFF")) {
    darkColors[k] = "linear-gradient(135deg, #0A84FF 0%, #0A84FF 100%)";
  }
});

const {
  styled,
  css,
  getCssText,
  globalCss,
  keyframes,
  config,
  reset,
  createTheme,
} = createStitches({
  theme: {
    colors: figma.color,
    fonts: {
      ...figma.fontFamilies,
      sans: figma.fontFamilies.inter,
      mono: figma.fontFamilies.robotoMono,
    },
    opacity: {
      1: "0.4",
    },
    spacing,
    sizes: {
      sidebarWidth: spacing[30],
      controlHeight: spacing[11],
    },
    /**
     * Use instead: textVariants / textStyles / <Text />
     */
    deprecatedFontSize: {
      1: "8px",
      2: "10px",
      3: "12px",
      // Legacy - don't use unless specified in Figma
      4: "14px",
      5: "19px",
      6: "21px",
      7: "27px",
      8: "35px",
      9: "59px",
    },

    borderRadius: {
      1: "1px",
      2: "2px",
      3: "3px",
      4: "4px",
      5: "5px",
      6: "6px",
      7: "8px",
      round: "50%",
      pill: "9999px",
    },
    zIndices: {
      max: "999",
    },
    easing: {
      easeOutQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
      easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
    shadows: figma.boxShadow,

    // Semantic values
    panel: {
      padding: `${spacing[5]} ${spacing[7]}`,
      paddingInline: spacing[7],
      paddingBlock: spacing[5],
    },
  },
  media: {
    tablet: "(min-width: 768px)",
    hover: "(any-hover: hover)",
  },
  utils: {
    p: (value: Stitches.PropertyValue<"padding">) => ({
      padding: value,
    }),
    pt: (value: Stitches.PropertyValue<"paddingTop">) => ({
      paddingTop: value,
    }),
    pr: (value: Stitches.PropertyValue<"paddingRight">) => ({
      paddingRight: value,
    }),
    pb: (value: Stitches.PropertyValue<"paddingBottom">) => ({
      paddingBottom: value,
    }),
    pl: (value: Stitches.PropertyValue<"paddingLeft">) => ({
      paddingLeft: value,
    }),
    px: (value: Stitches.PropertyValue<"paddingLeft">) => ({
      paddingInline: value,
    }),
    py: (value: Stitches.PropertyValue<"paddingTop">) => ({
      paddingBlock: value,
    }),

    m: (value: Stitches.PropertyValue<"margin">) => ({
      margin: value,
    }),
    mt: (value: Stitches.PropertyValue<"marginTop">) => ({
      marginTop: value,
    }),
    mr: (value: Stitches.PropertyValue<"marginRight">) => ({
      marginRight: value,
    }),
    mb: (value: Stitches.PropertyValue<"marginBottom">) => ({
      marginBottom: value,
    }),
    ml: (value: Stitches.PropertyValue<"marginLeft">) => ({
      marginLeft: value,
    }),
    mx: (value: Stitches.PropertyValue<"marginLeft">) => ({
      marginInline: value,
    }),
    my: (value: Stitches.PropertyValue<"marginTop">) => ({
      marginBlock: value,
    }),

    userSelect: (value: Stitches.PropertyValue<"userSelect">) => ({
      WebkitUserSelect: value,
      userSelect: value,
    }),

    size: (value: Stitches.PropertyValue<"width">) => ({
      width: value,
      height: value,
    }),

    appearance: (value: Stitches.PropertyValue<"appearance">) => ({
      WebkitAppearance: value,
      appearance: value,
    }),
    backgroundClip: (value: Stitches.PropertyValue<"backgroundClip">) => ({
      WebkitBackgroundClip: value,
      backgroundClip: value,
    }),
  },
});

type VariblesValues = typeof config.theme;

type VariblesNames = {
  [GroupKey in keyof VariblesValues]: {
    [VariableKey in keyof VariblesValues[GroupKey]]: string;
  };
};

const toVariblesNames = (values: VariblesValues): VariblesNames => {
  const result: Record<string, Record<string, string>> = {};
  for (const groupKey in values) {
    const group = values[groupKey as keyof VariblesValues];
    const groupResult: Record<string, string> = {};
    for (const variableKey in group) {
      groupResult[variableKey] = `$${groupKey}$${variableKey}`;
    }
    result[groupKey] = groupResult;
  }
  return result as VariblesNames;
};

export const theme = toVariblesNames(config.theme);

export const rawTheme = config.theme;

export const darkTheme = createTheme("dark-theme", {
  colors: darkColors as Record<string, string>,
});

export type CSS = Stitches.CSS<typeof config>;

export { styled, css, globalCss, keyframes, config };

export const flushCss = () => {
  const css = getCssText();
  reset();
  return css;
};
