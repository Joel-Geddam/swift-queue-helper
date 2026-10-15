// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages only serves plain files, so that deploy builds a client-only
// static site (PAGES_BUILD=1) instead of the server bundle Lovable hosts.
// VITE_BASE_PATH is the sub-folder Pages serves the app from, e.g. "/mediqueue/".
const staticBuild = process.env["PAGES_BUILD"] === "1";
const base = process.env["VITE_BASE_PATH"] || "/";

export default defineConfig({
  vite: { base },
  ...(staticBuild ? { nitro: false as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(staticBuild
      ? {
          spa: { enabled: true },
          router: { basepath: base === "/" ? "" : base.replace(/\/+$/, "") },
        }
      : {}),
  },
});
