import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

function buildRevision() {
  const supplied = process.env.VITE_BUILD_REVISION?.trim();
  if (supplied && /^[a-f0-9]{7,40}$/i.test(supplied)) return supplied;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "source";
  }
}

export default defineConfig({
  base: "/",
  plugins: [react()],
  define: { __ADMIN_BUILD_REVISION__: JSON.stringify(buildRevision()) },
  build: { outDir: "dist", emptyOutDir: true },
  // Local dev only (does not affect the production build): the admin app calls
  // /api/... (see src/ui.tsx / src/api.ts). Without this proxy, `npm run dev`
  // serves the React app on its own Vite origin with nothing behind /api, so
  // every screen's data request 404s and the section shows "Could not load
  // this section." Point target at wherever the FastAPI backend
  // (lbp/backend/main.py) actually runs locally - 8000 is FastAPI's default
  // if it's started as `uvicorn main:app --reload` with no --port override.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
