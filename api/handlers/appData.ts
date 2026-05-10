import type { Context } from "hono";

import {
  type AppDataFunctionInput,
  type AppDataFunctionName,
  type AppDataFunctionOutput,
} from "../features/appData/contract.ts";
import { appDataFunctions } from "../features/appData/registry.ts";

type RawAppDataRequest = {
  functionName: string;
  input: unknown;
};

/** Handles authenticated app data function calls. */
export async function appDataHandler(c: Context) {
  const request = await getAppDataRequest(c);
  if (!request) return c.json({ error: "Invalid app data request" }, 400);
  if (!isAppDataFunctionName(request.functionName)) {
    return c.json({ error: "Unknown app data function" }, 404);
  }

  const result = await callAppDataFunction(request.functionName, request.input);
  return c.json(result);
}

function isAppDataFunctionName(functionName: string): functionName is AppDataFunctionName {
  return functionName in appDataFunctions;
}

async function getAppDataRequest(c: Context): Promise<RawAppDataRequest | null> {
  try {
    const body = (await c.req.json()) as unknown;
    if (!isRecord(body)) return null;
    if (typeof body.functionName !== "string") return null;
    return {
      functionName: body.functionName,
      input: body.input,
    };
  } catch {
    return null;
  }
}

async function callAppDataFunction<TName extends AppDataFunctionName>(
  functionName: TName,
  rawInput: unknown,
): Promise<AppDataFunctionOutput<TName>> {
  const appDataFunction = appDataFunctions[functionName] as (
    input: AppDataFunctionInput<TName>,
  ) => Promise<AppDataFunctionOutput<TName>> | AppDataFunctionOutput<TName>;
  const input = rawInput as AppDataFunctionInput<TName>;
  return appDataFunction(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
