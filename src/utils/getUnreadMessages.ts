import { logger } from "../log.ts";
import { browser } from "../mcp.ts";
import { findElement } from "./findElement.ts";
import { getPageJsonSnapshot } from "./getPageJsonSnapshot.ts";

const log = logger("GET-UNREAD");

export const getUnreadMessages = async () => {
  try {
    const navResult = await browser.navigate("https://www.carousell.com.hk/inbox/received/");
    const snapshot = getPageJsonSnapshot(navResult);
    const mainElement = snapshot.find((element) => {
      if (typeof element === "object" && element !== null) {
        const key = Object.keys(element)[0];
        return key.startsWith("main");
      }
      return false;
    });
    const mainValue = Object.values(mainElement ?? {})[0];
    const countElements = findElement(mainValue, /(\d+)\s+unread\s+chat/i);
    const count = countElements.length > 0 ? parseInt(countElements[0].match(/(\d+)\s+unread\s+chat/i)?.[1] ?? "0") : 0;

    return count;
  } catch (err) {
    log.error("Could not get unread message count.");
    throw err;
  }
};
