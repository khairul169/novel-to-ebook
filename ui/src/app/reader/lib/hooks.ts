import { useStore } from "zustand";
import { settingsStore } from "./stores";
import { appStore } from "@/stores/app.store";

export function useReaderTheme() {
  const theme = useStore(appStore, (i) => i.theme);
  const styles = useStore(settingsStore, (i) => i.styles);
  return styles.theme?.[theme] || {};
}
