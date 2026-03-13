import ChapterEditor from "../components/chapter-editor";
import { openTab } from "./stores";

export function stripHtmlTags(str: string) {
  return str.replace(/<[^>]+>/g, "");
}

export function openEditorTab(data: { id: number; title: string }) {
  openTab({
    href: `chapter/${data.id}`,
    title: data.title,
    element: <ChapterEditor id={data.id} />,
  });
}
