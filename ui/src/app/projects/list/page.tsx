import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { $api } from "@/lib/api";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function ProjectListPage() {
  const [search, setSearch] = useState("");
  const { data: projects } = $api.useQuery("get", "/projects");
  const create = $api.useMutation("post", "/projects");
  const navigate = useNavigate();

  const onCreateProject = () => {
    create.mutate(
      { body: { title: "Untitled", author: "Anonymous" } },
      {
        onSuccess(data) {
          navigate(`/projects/${data.id}`);
          toast.success("Project created");
        },
        onError(err) {
          toast.error((err as Error).message);
        },
      },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 p-6 pb-0">
        <InputGroup className="w-full max-w-3xl">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <h2 className="font-medium text-xl mx-6 mt-10">Projects</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] p-2">
        <button
          className="text-foreground p-4 rounded hover:bg-secondary flex flex-col items-center justify-center gap-2 border m-4 cursor-pointer"
          title={"123"}
          onClick={onCreateProject}
          disabled={create.isPending}
        >
          <PlusIcon />
          <p>New</p>
        </button>
        {projects?.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="text-foreground p-4 hover:bg-secondary"
            title={project.title}
          >
            <div className="w-full aspect-3/4 bg-background relative overflow-hidden">
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-md line-clamp-3">{project.title}</p>
                <p className="text-sm mt-2 opacity-50">{project.author}</p>
              </div>

              {project.cover ? (
                <img
                  src={project.cover}
                  alt={project.title}
                  className="absolute z-1 inset-0 w-full h-full object-cover rounded overflow-hidden shadow"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>

            <div className="line-clamp-2 mt-2 text-xs font-medium">
              {project.title}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
