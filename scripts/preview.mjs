import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    let url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (!url.startsWith("/fitspoh/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    url = url.slice("/fitspoh/".length) || "index.html";
    const target = path.resolve(root, url);
    if (
      !target.startsWith(root + path.sep) ||
      !fs.existsSync(target) ||
      fs.statSync(target).isDirectory()
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(target).pipe(res);
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Fitspoh preview: http://127.0.0.1:4173/fitspoh/"),
  );
