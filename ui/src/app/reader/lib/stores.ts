import { deepMerge, isMobile, setByPath } from "@/lib/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReaderStyles } from "./utils";
import type { Paths, PathValue } from "@/lib/types";

type SettingsStore = {
  flow: "paginated" | "scrolled";
  styles: Omit<ReaderStyles, "colorScheme">;
};

export const fontFamilies = [
  {
    label: "Bitter",
    value: "'Bitter', serif",
  },
  {
    label: "Roboto Slab",
    value: "'Roboto Slab', serif",
  },
  {
    label: "Noto Sans",
    value: "'Noto Sans', sans-serif",
  },
  {
    label: "Roboto",
    value: "'Roboto', sans-serif",
  },
];

export const settingsStore = create<SettingsStore>()(
  persist<SettingsStore>(
    () => ({
      flow: "paginated",
      styles: {
        spacing: 1.6,
        justify: true,
        hyphenate: true,
        fontFamily: fontFamilies[0].value,
        fontSize: Math.round(16 * 1.2),
        theme: {
          dark: {
            background: "#222",
            color: "#ddd",
            linkColor: "lightblue",
          },
          light: {
            background: "#eee",
            color: "#333",
            linkColor: "blue",
          },
        },
      },
    }),
    { name: "reader/settings-store" },
  ),
);

export function setSettings<P extends Paths<SettingsStore>>(
  pathOrObject: P | Partial<SettingsStore>,
  value?: PathValue<SettingsStore, P>,
) {
  settingsStore.setState((state) => {
    const newState = structuredClone(state);

    if (typeof pathOrObject === "string") {
      setByPath(newState, pathOrObject, value);
    } else {
      deepMerge(newState, pathOrObject);
    }

    return newState;
  });
}

type SidebarStore = {
  isVisible: boolean;
  isSticky: boolean;
};

export const sidebarStore = create<SidebarStore>()(
  persist<SidebarStore>(
    () => ({
      isVisible: false,
      isSticky: isMobile ? true : false,
    }),
    {
      name: "reader/sidebar-store",
      partialize: (state) => ({ isSticky: state.isSticky }) as never,
    },
  ),
);
