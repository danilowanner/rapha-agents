import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware } from "../authHeaderMiddleware.ts";
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

export const Route = createFileRoute("/app-data")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        const appDataRequest = await getAppDataRequest(request);
        if (!appDataRequest) return Response.json({ error: "Invalid app data request" }, { status: 400 });
        if (!isAppDataFunctionName(appDataRequest.functionName)) {
          return Response.json({ error: "Unknown app data function" }, { status: 404 });
        }

        const result = await callAppDataFunction(appDataRequest.functionName, appDataRequest.input);
        return Response.json(result);
      },
    },
  },
});

function isAppDataFunctionName(functionName: string): functionName is AppDataFunctionName {
  return functionName in appDataFunctions;
}

async function getAppDataRequest(request: Request): Promise<RawAppDataRequest | null> {
  try {
    const body = (await request.json()) as unknown;
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
