import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

function lunarCmsApiPlugin(): Plugin {
  return {
    name: "lunar-cms-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";
        if (!url.startsWith("/api/v1/")) return next();
        try {
          const { lunarApiMiddleware } = await import(
            "./src/lib/api-handler.node.ts"
          );
          return lunarApiMiddleware()(req, res, next);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

function lunarRssPlugin(): Plugin {
  return {
    name: "lunar-cms-rss",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/feed.xml") return next();
        try {
          const { rssMiddleware } = await import("./src/lib/rss-handler.node.ts");
          return rssMiddleware()(req, res, next);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`RSS error: ${String(err)}`);
        }
      });
    },
  };
}

function lunarSitemapPlugin(): Plugin {
  return {
    name: "lunar-cms-sitemap",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/sitemap.xml") return next();
        try {
          const { sitemapMiddleware } = await import("./src/lib/sitemap-handler.node.ts");
          return sitemapMiddleware()(req, res, next);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Sitemap error: ${String(err)}`);
        }
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [lunarCmsApiPlugin(), lunarRssPlugin(), lunarSitemapPlugin()],
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
  },
});
