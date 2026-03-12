import { create, useStore } from "zustand";

type TabStore = {
  tabs: { href: string; title: string; element: React.ReactNode }[];
  curTab: string;
};

export const tabStore = create<TabStore>()(() => ({
  tabs: [],
  curTab: "",
}));

export function openTab(tab: TabStore["tabs"][number]) {
  const { tabs } = tabStore.getState();
  if (!tabs.find((t) => t.href === tab.href)) {
    tabStore.setState({ tabs: [...tabs, tab], curTab: tab.href });
  } else {
    tabStore.setState({ curTab: tab.href });
  }
}

export const useTabStore = () => useStore(tabStore);
