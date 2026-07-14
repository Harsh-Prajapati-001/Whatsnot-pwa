import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(path = "/dashboard") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Whatsnot application on primary deep links", async () => {
  for (const path of ["/dashboard", "/deployments", "/monitoring", "/logs", "/settings"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /<title>Whatsnot<\/title>/i);
    assert.match(html, /manifest\.webmanifest/i);
    assert.match(html, /Whatsnot/);
  }
});

test("manifest contains the complete install contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Whatsnot — WhatsApp Business Notifications");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/dashboard?source=pwa");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.display_override, ["window-controls-overlay", "standalone", "browser"]);
  assert.equal(manifest.theme_color, "#4F46E5");
  assert.equal(manifest.icons.filter((icon) => icon.purpose === "any").length, 9);
  assert.equal(manifest.icons.filter((icon) => icon.purpose === "maskable").length, 2);
  assert.deepEqual(manifest.shortcuts.map((item) => item.url), ["/systems", "/activity", "/dashboard", "/setup"]);
  assert.equal(manifest.screenshots.length, 2);
  for (const item of [...manifest.icons, ...manifest.screenshots]) {
    const file = new URL(`../public${item.src}`, import.meta.url);
    assert.ok((await stat(file)).size > 100, item.src);
  }
});

test("service worker never caches sensitive application data", async () => {
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /isSensitive/);
  assert.match(sw, /logs\|\\\/messages\|\\\/conversations\|\\\/api-keys\|\\\/environment\|\\\/secrets\|\\\/webhooks/i);
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /notificationclick/);
  assert.match(sw, /whatsnot-safe-actions/);
  assert.doesNotMatch(sw, /accessToken|apiKey|messageContent|webhookSecret/);
});
