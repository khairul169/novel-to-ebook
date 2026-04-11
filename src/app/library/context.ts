import { scanLibrary, type LibraryItems } from "./utils";

let library: LibraryItems = [];

export async function rescanLibrary() {
  try {
    console.log("Scanning library...");
    const res = await scanLibrary([process.env.DATA_PATH || "./data"]);
    library = res;
    console.log("Library scanned!");
  } catch (err) {
    console.error("Cannot scan library!", err);
  }
}

export function getLibrary() {
  return library;
}
