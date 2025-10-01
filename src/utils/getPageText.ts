import { extractText } from "./extractText.ts";
import { getPageJsonSnapshot } from "./getPageJsonSnapshot.ts";

export function getPageText(result: any): string {
  const json = getPageJsonSnapshot(result);
  const mainElement = json.find((element) => {
    if (typeof element === "object" && element !== null) {
      const key = Object.keys(element)[0];
      return key.startsWith("main");
    }
    return false;
  });
  return extractText(Object.values(mainElement ?? {})[0]);
}
