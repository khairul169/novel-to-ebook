import { useQuery } from "@tanstack/react-query";
import { getHistories, syncHistories } from "./utils";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { $api } from "@/lib/api";
import { toast } from "sonner";

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

export function useRescanLibrary() {
  return $api.useMutation("post", "/library/rescan", {
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["get", "/library"] });
      toast.success("Library rescan success!");
    },
    onError(err) {
      toast.error((err as Error).message);
    },
  });
}
