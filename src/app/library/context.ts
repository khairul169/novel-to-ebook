import { scanLibrary, type LibraryItems } from "./utils";

let library: LibraryItems = [];

export async function rescanLibrary() {
  try {
    const res = await scanLibrary([process.cwd() + "/data"]);
    library = res;
  } catch (err) {
    console.error("Cannot scan library!", err);
  }
}

export function getLibrary() {
  return library;
}
