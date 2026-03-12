import BackButton from "@/components/ui/back-button";
import { $api } from "@/lib/api";
import { XIcon } from "lucide-react";
import { useParams } from "react-router";
import Sidebar from "./components/sidebar";
import { ProjectContext } from "./lib/context";
import AddChapterModal from "./components/add-chapter-modal";
import MainTabs from "./components/main-tabs";

export default function ProjectViewPage() {
  const { id } = useParams() as { id: string };
  const { data: project } = $api.useQuery("get", "/projects/{id}", {
    params: { path: { id } },
  });

  return (
    <ProjectContext.Provider value={{ project: project! }}>
      <div className="h-screen-dvh flex flex-col items-stretch overflow-hidden">
        <div className="w-full bg-secondary border-b h-12 flex items-center px-4">
          <p className="text-sm font-medium">{project?.title}</p>
          {/* <Button variant="ghost" size="icon-xs" className="ml-2">
          <PencilIcon />
        </Button> */}

          <div className="flex-1" />

          <BackButton to="/projects" variant="outline" size="icon-xs">
            <XIcon />
          </BackButton>
        </div>

        <div className="flex-1 flex items-stretch overflow-hidden">
          {project != null && <Sidebar />}

          <MainTabs />
        </div>
      </div>

      <AddChapterModal />
    </ProjectContext.Provider>
  );
}
