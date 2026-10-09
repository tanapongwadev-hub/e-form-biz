import { defineConfig } from "vite"
import { readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveFormFile } from "./server/form_path.ts"

const root = dirname(fileURLToPath(import.meta.url))
const formEntries = Object.fromEntries(
  readdirSync(resolve(root, "forms"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => [
      `forms/${entry.name.slice(0, -5)}`,
      resolve(root, "forms", entry.name)
    ])
)

export default defineConfig({
  appType: "spa",
  plugins: [{
    name: "form-paths",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) return next()
        const [pathname, query] = request.url.split("?", 2)
        const formFile = resolveFormFile(pathname, resolve(root, "forms"))
        if (formFile) request.url = `/forms/${formFile.split("/").pop()}${query ? `?${query}` : ""}`
        next()
      })
    }
  }],
  resolve: {
    alias: {
      "stimulus-datepicker": resolve(root, "node_modules/stimulus-datepicker/src/datepicker.js")
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.PORT || 3000}`,
      "/bizportal": `http://127.0.0.1:${process.env.PORT || 3000}`
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        ...formEntries
      }
    }
  }
})
