import { create } from "zustand";
import { persist } from "zustand/middleware";

type AppStore = {
  theme: "dark" | "light";
};

export const appStore = create<AppStore>()(
  persist<AppStore>(
    () => ({
      theme: "dark",
    }),
    { name: "app/store" },
  ),
);

export const setAppTheme = (appTheme: AppStore["theme"]) => {
  appStore.setState({ theme: appTheme });
};
