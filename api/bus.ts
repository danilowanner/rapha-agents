import type { Context } from "hono";

type Input = {
  route: "26-central";
};

type ETA = {
  date: string;
  minFromNow: number;
};

const ROUTE_CONFIG = {
  "26-central": {
    name: "Route 26 to Central",
    url: "https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/002741/26",
  },
};

/**
 * Handler for bus ETA endpoint
 */
export async function busHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<Input>();

    if (!body.route || !ROUTE_CONFIG[body.route]) {
      return c.json({ error: "Invalid route. Supported: 26-central" }, 400);
    }

    const config = ROUTE_CONFIG[body.route];
    const response = await fetch(config.url);

    if (!response.ok) {
      return c.json({ error: `Failed to fetch bus data: ${response.statusText}` }, 500);
    }

    const data = (await response.json()) as ApiResponse;
    const now = new Date();

    const etas: ETA[] = data.data
      .filter((item: ApiResponse["data"][0]) => item.eta)
      .map((item: ApiResponse["data"][0]) => {
        const etaDate = new Date(item.eta);
        const minFromNow = Math.round((etaDate.getTime() - now.getTime()) / 1000 / 60);
        return {
          date: item.eta,
          minFromNow,
        };
      });

    const humanReadable =
      `${config.name}\n` +
      etas
        .map((eta) => {
          const etaDate = new Date(eta.date);
          const timeStr = etaDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return `${timeStr} (${eta.minFromNow} min)`;
        })
        .join("\n");

    return c.json({ etas, humanReadable });
  } catch (error) {
    console.error("Bus handler error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

type ApiResponse = {
  type: string;
  version: string;
  generated_timestamp: string;
  data: Array<{
    co: string;
    route: string;
    dir: string;
    seq: number;
    stop: string;
    dest_tc: string;
    dest_en: string;
    eta: string;
    rmk_tc: string;
    eta_seq: number;
    dest_sc: string;
    rmk_en: string;
    rmk_sc: string;
    data_timestamp: string;
  }>;
};
