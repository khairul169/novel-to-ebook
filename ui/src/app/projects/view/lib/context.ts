import type { JsonRes } from "@/lib/api";
import { createContext, useContext } from "react";

type Project = Omit<JsonRes<"/projects/{id}", "get">, "config"> & {
  config: {
    fontDecryptMap: string;
  } | null;
};

export const ProjectContext = createContext<{
  project: Project;
}>(null!);

export function useProjectContext() {
  return useContext(ProjectContext)!;
}
