import { createBrowserRouter, RouterProvider } from "react-router";
import LibraryPage from "./app/library/page";
import ReaderPage from "./app/reader/page";
import ExtractPage from "./app/extract/page";

const router = createBrowserRouter([
  {
    index: true,
    Component: LibraryPage,
  },
  {
    path: "reader",
    Component: ReaderPage,
  },
  {
    path: "extract",
    Component: ExtractPage,
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
