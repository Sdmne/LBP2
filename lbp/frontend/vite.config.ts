import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const firebaseEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build") {
    const missing = firebaseEnvKeys.filter((key) => !env[key]?.trim());
    if (missing.length) {
      throw new Error(`Missing required frontend environment: ${missing.join(", ")}`);
    }
    if (env.VITE_FIREBASE_PROJECT_ID !== "parents-698f8") {
      throw new Error("Frontend build is restricted to Firebase project parents-698f8");
    }
  }

  return {
    base: "/",
    plugins: [react()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@firebase/") || id.includes("node_modules/firebase/")) return "firebase";
          },
        },
      },
    },
    // Local dev only (does not affect the production build) - same reasoning as
    // admin/vite.config.ts: src/api.ts calls /api/..., proxy it to wherever the
    // FastAPI backend runs locally so `npm run dev` can reach it.
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
