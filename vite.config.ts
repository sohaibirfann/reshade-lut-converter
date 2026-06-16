import { defineConfig } from "vite";

// BASE_PATH lets GitHub Pages serve from /<repo>/ while local/Netlify stay at root.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
});
