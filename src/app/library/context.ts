import { scanLibrary, type LibraryItems } from "./utils";

let library: LibraryItems = [];
let scanController: AbortController | null = null;

export async function rescanLibrary() {
  try {
    console.log("Scanning library...");

    scanController?.abort();
    scanController = new AbortController();

    const res = await scanLibrary([process.env.DATA_PATH || "./data"], {
      signal: scanController.signal,
    });

    scanController.signal.throwIfAborted();
    library = res;

    console.log("Library scanned!");
  } catch (err) {
    console.error("Cannot scan library!", err);
  } finally {
    scanController = null;
  }
}

export function getLibrary() {
  return library;
}
