import { useQuery } from "@tanstack/react-query";
import { getHistories } from "./utils";

export function useHistories() {
  return useQuery({
    queryKey: ["histories"],
    queryFn: () => getHistories(),
  });
}
