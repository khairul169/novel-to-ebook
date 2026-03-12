import { create, useStore } from "zustand";

export function createDisclosure<TData = any>(
  initialData: TData | null = null,
) {
  const store = create<{ open: boolean; data: TData | null }>(() => ({
    open: false,
    data: initialData,
  }));

  return {
    store,
    setOpen(open: boolean) {
      store.setState({ open });
    },
    setData(data: TData | null) {
      store.setState({ data });
    },
    onOpen(data: TData | null = null) {
      store.setState({ open: true, data });
    },
    useStore() {
      return useStore(store);
    },
  };
}
