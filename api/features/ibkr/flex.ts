import { env } from "../../../libs/env.ts";
import { elementText } from "./xml.ts";

const SEND_REQUEST_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
const GET_STATEMENT_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";
const FLEX_VERSION = "3";
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Downloads one Flex statement. Requires both Flex env vars.
 */
export async function fetchFlexStatementXml(): Promise<string> {
  const token = env.ibkrFlexToken;
  const queryId = env.ibkrFlexQueryId;
  if (!token || !queryId) throw new Error("IBKR_FLEX_TOKEN and IBKR_FLEX_QUERY_ID are required.");

  const referenceCode = await sendRequest(token, queryId);
  return getStatement(token, referenceCode);
}

async function sendRequest(token: string, queryId: string): Promise<string> {
  const xml = await flexGet(SEND_REQUEST_URL, token, queryId);
  const referenceCode = elementText(xml, "ReferenceCode");
  if (elementText(xml, "Status") === "Success" && referenceCode) return referenceCode;
  throw new Error(flexError(xml, "Flex SendRequest failed."));
}

async function getStatement(token: string, referenceCode: string, attempt = 1): Promise<string> {
  const xml = await flexGet(GET_STATEMENT_URL, token, referenceCode);
  if (!isGenerating(xml)) {
    if (elementText(xml, "Status") === "Fail") throw new Error(flexError(xml, "Flex GetStatement failed."));
    return xml;
  }
  if (attempt === MAX_ATTEMPTS) throw new Error("Flex statement was still generating.");
  await delay(RETRY_DELAY_MS);
  return getStatement(token, referenceCode, attempt + 1);
}

async function flexGet(url: string, token: string, query: string): Promise<string> {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("t", token);
  requestUrl.searchParams.set("q", query);
  requestUrl.searchParams.set("v", FLEX_VERSION);

  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Flex request failed with HTTP ${response.status}.`);
  return response.text();
}

function isGenerating(xml: string): boolean {
  const message = elementText(xml, "ErrorMessage") ?? "";
  return elementText(xml, "ErrorCode") === "1019" || message.toLowerCase().includes("in progress");
}

function flexError(xml: string, fallback: string): string {
  return elementText(xml, "ErrorMessage") ?? fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
