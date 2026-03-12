import type { JsonRes } from "@/lib/api";
import { createContext, useContext } from "react";

type Project = JsonRes<"/projects/{id}", "get">;

export const ProjectContext = createContext<{
  project: Project;
}>(null!);

export function useProjectContext() {
  return useContext(ProjectContext)!;
}
