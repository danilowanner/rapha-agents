import { tool } from "ai";
import z from "zod";

import { fetchFlexStatementXml } from "./flex.ts";
import { elements } from "./xml.ts";

const positionSchema = z.object({
  symbol: z.string(),
  description: z.string().nullable().describe("Instrument name from Flex."),
  isin: z.string().nullable().describe("ISIN when the Flex query includes it. Use this to match the sheet."),
  qty: z.number().describe("Share quantity. Negative is a short."),
  conid: z.number().nullable().describe("IB contract id when the Flex query includes it."),
  listingCurrency: z.string().describe("Currency the instrument is priced in."),
  markPriceListing: z.number().nullable().describe("Price per share in listingCurrency."),
  marketValueListing: z.number().nullable().describe("Position value in listingCurrency."),
  fxRateToBase: z.number().nullable().describe("Multiply listing currency by this rate to get base currency."),
  marketValueBase: z.number().nullable().describe("Position value in baseCurrency."),
  weight: z
    .number()
    .nullable()
    .describe("marketValueBase / nlvBase. Cash is not a position, so weights sum to less than 1."),
});

const flexNumber = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return null;
    const parsed = z.coerce.number().safeParse(trimmed);
    return parsed.success ? parsed.data : null;
  });

const flexConid = flexNumber.transform((value) => (value === null ? null : Math.trunc(value)));

const flexText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  });

const holdingsSchema = z.object({
  accountId: z.string(),
  asOf: z.string().describe("Flex report date, YYYY-MM-DD."),
  baseCurrency: z.string().describe("Account base currency. nlvBase and cashBase use this currency."),
  nlvBase: z.number().describe("Net liquidation value in baseCurrency."),
  cashBase: z.number().describe("Cash in baseCurrency."),
  positions: z.array(positionSchema),
});

type Holdings = z.infer<typeof holdingsSchema>;
type Position = z.infer<typeof positionSchema>;

/**
 * Read-only IBKR holdings from the Flex Web Service.
 */
export async function getHoldings(): Promise<Holdings> {
  return holdingsFromFlexXml(await fetchFlexStatementXml());
}

/**
 * MCP tool for Grok. Not registered on the OpenAPI tool server.
 */
export const getHoldingsTool = tool({
  description: [
    "Read-only IBKR holdings from the Flex Web Service. Does not place or draft orders.",
    "nlvBase and cashBase are in baseCurrency.",
    "markPriceListing and marketValueListing are in listingCurrency. marketValueBase is in baseCurrency.",
    "Match positions to the sheet with isin. description is the instrument name.",
    "weight is marketValueBase / nlvBase. Cash is not a position, so weights sum to less than 1.",
  ].join(" "),
  inputSchema: z.object({}),
  outputSchema: holdingsSchema,
  execute: async () => getHoldings(),
});

function holdingsFromFlexXml(xml: string): Holdings {
  const statement = elements(xml, "FlexStatement")[0];
  if (!statement) throw new Error("Flex statement is missing.");

  const account = elements(xml, "AccountInformation")[0];
  const baseCurrency = account?.currency;
  if (!baseCurrency || baseCurrency === "BASE_SUMMARY") {
    throw new Error("Flex query is missing Account Information currency.");
  }

  const equity = latestByReportDate(elements(xml, "EquitySummaryByReportDateInBase"));
  const nlvBase = flexNumber.parse(equity?.total);
  const cashBase = flexNumber.parse(equity?.cash);
  if (!equity || nlvBase === null || cashBase === null) {
    throw new Error("Flex query is missing Equity Summary in Base total or cash.");
  }

  const accountId = account?.accountId || statement.accountId;
  if (!accountId) throw new Error("Flex statement is missing accountId.");

  const asOf = toIsoDate(equity.reportDate) ?? toIsoDate(statement.toDate);
  if (!asOf) throw new Error("Flex statement is missing a report date.");

  return {
    accountId,
    asOf,
    baseCurrency,
    nlvBase,
    cashBase,
    positions: openPositions(xml, accountId, baseCurrency, nlvBase),
  };
}

function openPositions(xml: string, accountId: string, baseCurrency: string, nlvBase: number): Position[] {
  const rows = elements(xml, "OpenPosition").filter((row) => {
    if (row.assetCategory === "CASH" || !row.symbol) return false;
    return !row.accountId || row.accountId === accountId;
  });
  const summary = rows.filter((row) => row.levelOfDetail === "SUMMARY");
  const selected = summary.length > 0 ? summary : rows.filter((row) => row.levelOfDetail !== "LOT");
  return selected.map((row) => toPosition(row, baseCurrency, nlvBase)).sort(bySymbol);
}

function toPosition(row: Record<string, string>, baseCurrency: string, nlvBase: number): Position {
  const listingCurrency = row.currency || baseCurrency;
  const markPriceListing = flexNumber.parse(row.markPrice);
  const marketValueListing = flexNumber.parse(row.positionValue);
  const quotedRate = flexNumber.parse(row.fxRateToBase);
  const fxRateToBase = quotedRate ?? (listingCurrency === baseCurrency ? 1 : null);
  const marketValueBase =
    marketValueListing !== null && fxRateToBase !== null ? round(marketValueListing * fxRateToBase, 4) : null;
  const weight = marketValueBase !== null && nlvBase !== 0 ? round(marketValueBase / nlvBase, 6) : null;
  return {
    symbol: row.symbol ?? "",
    description: flexText.parse(row.description),
    isin: flexText.parse(row.isin),
    qty: flexNumber.parse(row.position) ?? 0,
    conid: flexConid.parse(row.conid),
    listingCurrency,
    markPriceListing: markPriceListing === null ? null : round(markPriceListing, 4),
    marketValueListing: marketValueListing === null ? null : round(marketValueListing, 4),
    fxRateToBase,
    marketValueBase,
    weight,
  };
}

function latestByReportDate(rows: Record<string, string>[]): Record<string, string> | undefined {
  return rows.reduce<Record<string, string> | undefined>((latest, row) => {
    if (!latest) return row;
    return (row.reportDate ?? "") > (latest.reportDate ?? "") ? row : latest;
  }, undefined);
}

function toIsoDate(value: string | undefined): string | null {
  const digits = value?.slice(0, 8);
  if (!digits || !/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bySymbol(left: Position, right: Position): number {
  return left.symbol.localeCompare(right.symbol);
}
