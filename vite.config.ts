// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function stripTsconfigPathsPlugin(cfg: any) {
  const removeMatcher = (p: any) => {
    try {
      const name = p && (p.name || p.apply || p.enforce || "");
      if (typeof name === "string" && /tsconfig-paths/i.test(name)) return true;
    } catch (e) {}
    return false;
  };

  if (cfg) {
    if (Array.isArray(cfg.plugins)) cfg.plugins = cfg.plugins.filter((p: any) => !removeMatcher(p));
    if (cfg.vite && Array.isArray(cfg.vite.plugins))
      cfg.vite.plugins = cfg.vite.plugins.filter((p: any) => !removeMatcher(p));
  }

  return cfg;
}

const base = {
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Use Vite's native tsconfig paths resolution to avoid duplicate-plugin warning
  vite: {
    resolve: {
      tsconfigPaths: true,
    },
  },
};

export default async (env?: any) => {
  const cfgOrFn = defineConfig(base as any) as any;
  const cfg = typeof cfgOrFn === "function" ? await cfgOrFn(env) : cfgOrFn;
  return stripTsconfigPathsPlugin(cfg as any);
};
