import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // server: {
  //   ...(isDev && {
  //     hmr: {
  //       protocol: "wss",
  //       host: "localhost",
  //       port: 3000,
  //       clientPort: 3000,
  //     },
  //   }),
  // },
});
