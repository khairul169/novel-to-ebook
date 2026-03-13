import { $api } from "@/lib/api";
import { useParams } from "react-router";
import Sidebar from "./components/sidebar";
import { ProjectContext } from "./lib/context";
import AddChapterModal from "./components/add-chapter-modal";
import MainTabs from "./components/main-tabs";
import { useEffect } from "react";
import { setTabs } from "./lib/stores";
import RenameChapterModal from "./components/rename-chapter-modal";

export default function ProjectViewPage() {
  const { id } = useParams() as { id: string };
  const { data: project } = $api.useQuery("get", "/projects/{id}", {
    params: { path: { id } },
  });

  useEffect(() => {
    setTabs([]);
  }, [id]);

  return (
    <ProjectContext.Provider value={{ project: project! }}>
      <div className="h-screen-dvh flex items-stretch overflow-hidden">
        {project != null && <Sidebar />}

        <MainTabs />
      </div>

      <AddChapterModal />
      <RenameChapterModal />
    </ProjectContext.Provider>
  );
}
