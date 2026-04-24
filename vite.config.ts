import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("recharts") || id.includes("d3-")) return "recharts";
          if (id.includes("react-markdown") || id.includes("remark") || id.includes("rehype") || id.includes("unified") || id.includes("mdast") || id.includes("micromark")) return "markdown";
          if (id.includes("konva") || id.includes("react-konva")) return "konva";
          if (id.includes("katex") || id.includes("react-katex")) return "katex";
          if (id.includes("/components/notebook/") || id.includes("/notebookPageActions") || id.includes("/notebookSyncStore")) return "notebook";
          if (id.includes("/components/FloraChatPanel") || id.includes("/floraClient") || id.includes("/flora-engine")) return "flora";
          if (id.includes("/components/QuizDialog") || id.includes("/components/TopicNotesDialog")) return "study-tools";
          if (id.includes("tiptap") || id.includes("prosemirror")) return "editor";
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "analyze" && visualizer({
      open: true,
      filename: "dist/stats.html",
      title: "Bundle Analysis",
      brotliSize: true,
    }),
    compression({
      algorithm: "gzip",
      ext: ".gz",
      deleteOriginFile: false,
    }),
    compression({
      algorithm: "brotli",
      ext: ".br",
      deleteOriginFile: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
