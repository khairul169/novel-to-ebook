import { isMobile } from "@/lib/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReaderStyles } from "./utils";

type SettingsStore = {
  styles: Omit<ReaderStyles, "colorScheme">;
};

export const settingsStore = create<SettingsStore>()(
  persist<SettingsStore>(
    () => ({
      styles: {
        spacing: 1.6,
        justify: true,
        hyphenate: true,
        fontSize: 16 * 1.2,
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
