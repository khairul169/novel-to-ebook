import { useQuery } from "@tanstack/react-query";
import { getHistories, syncHistories } from "./utils";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function useHistories() {
  useEffect(() => {
    syncHistories().then(() => {
      queryClient.invalidateQueries({ queryKey: ["histories"] });
    });
  }, []);

  return useQuery({
    queryKey: ["histories"],
    queryFn: () => getHistories(),
  });
}
