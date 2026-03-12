import fs from "fs/promises";
import type { Selector } from "../app/projects/schema";

export const KNOWN_SELECTORS_PATH = "./selectors.json";

let knownSelectors: Record<string, Selector> = {};

export async function loadSelectors() {
  if (await fs.exists(KNOWN_SELECTORS_PATH)) {
    knownSelectors = JSON.parse(
      await fs.readFile(KNOWN_SELECTORS_PATH, "utf-8"),
    );
  }
}

export async function saveSelector(domain: string, selector: Selector) {
  knownSelectors[domain] = selector;
  await fs.writeFile(
    KNOWN_SELECTORS_PATH,
    JSON.stringify(knownSelectors, null, 2),
  );
  return selector;
}

export function getSelector(domain: string) {
  return knownSelectors[domain];
}
