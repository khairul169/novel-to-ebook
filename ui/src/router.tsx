import { createHashRouter, RouterProvider } from "react-router";
import LibraryPage from "./app/library/page";
import ReaderPage from "./app/reader/page";
import ProjectListPage from "./app/projects/list/page";
import ProjectViewPage from "./app/projects/view/page";

const router = createHashRouter([
  {
    index: true,
    Component: LibraryPage,
  },
  {
    path: "reader",
    Component: ReaderPage,
  },
  {
    path: "projects",
    children: [
      {
        index: true,
        Component: ProjectListPage,
      },
      {
        path: ":id",
        Component: ProjectViewPage,
      },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
