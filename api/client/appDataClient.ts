import type {
  AppDataFunctionInput,
  AppDataFunctionName,
  AppDataFunctionOutput,
  AppDataRequest,
} from "../features/appData/contract.ts";

/** Calls an authenticated app data function from the client shell. */
export async function appDataQuery<TName extends AppDataFunctionName>(
  functionName: TName,
  input: AppDataFunctionInput<TName>,
): Promise<AppDataFunctionOutput<TName>> {
  const response = await fetch(getAppDataUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ functionName, input } satisfies AppDataRequest<TName>),
  });

  if (!response.ok) throw new Error(await getAppDataError(response));
  return (await response.json()) as AppDataFunctionOutput<TName>;
}

function getAppDataUrl() {
  const url = new URL("/app-data", window.location.origin);
  const token = new URLSearchParams(window.location.search).get("token");
  if (token) url.searchParams.set("token", token);
  return url;
}

async function getAppDataError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    return `App data request failed (${response.status})`;
  }
  return `App data request failed (${response.status})`;
}
