import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "AntiProcra",
  version: "1.0.0",
  description:
    "Adds friction and time awareness to procrastination sites like Facebook and YouTube.",
  permissions: ["storage", "alarms", "tabs", "idle"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: [
        "*://*.facebook.com/*",
        "*://*.youtube.com/*",
      ],
      js: ["src/content/index.ts"],
      css: ["src/content/content.css"],
      run_at: "document_start",
    },
  ],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
});
