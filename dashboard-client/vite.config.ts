import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy REST API requests to the dashboard server
            "/api": {
                target: "http://localhost:4000",
                changeOrigin: true,
            },
            // Proxy WebSocket connections to the dashboard server
            "/ws": {
                target: "ws://localhost:4000",
                ws: true,
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "dist",
    },
});
