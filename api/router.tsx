import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/** Creates application router for each request. */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}
