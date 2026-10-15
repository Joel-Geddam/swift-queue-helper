import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// GitHub Pages serves the app from /<repo-name>/, so the router has to match
// routes under that prefix. It stays empty on Lovable's hosting, where the app
// lives at "/".
const basepath = (import.meta.env["VITE_BASE_PATH"] || "").replace(/\/+$/, "");

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    basepath,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
