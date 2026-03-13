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

export function closeTab(
  href: string,
  type: "self" | "other" | "all" | "right" = "self",
) {
  const state = tabStore.getState();
  let tabs = [...state.tabs];
  let curTab = state.curTab;

  if (type === "self") {
    tabs = tabs.filter((t) => t.href !== href);
    curTab = curTab === href ? tabs[0]?.href || "" : curTab;
  }
  if (type === "other") {
    tabs = tabs.filter((t) => t.href === href);
    curTab = tabs[0]?.href || "";
  }
  if (type === "right") {
    const tabIdx = tabs.findIndex((t) => t.href === href);
    tabs = tabs.slice(0, tabIdx + 1);
    curTab = !tabs.find((t) => t.href === curTab)
      ? tabs[tabs.length - 1]?.href || ""
      : curTab;
  }
  if (type === "all") {
    tabs = [];
    curTab = "";
  }

  tabStore.setState({
    tabs,
    curTab,
  });
}

export function setTabs(tabs: TabStore["tabs"]) {
  tabStore.setState({ tabs, curTab: tabs[0]?.href || "" });
}

export const useTabStore = () => useStore(tabStore);
