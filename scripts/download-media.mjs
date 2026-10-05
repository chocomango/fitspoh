import fs from "node:fs";
import path from "node:path";
const exercises = JSON.parse(
  fs.readFileSync("src/data/exercises.json", "utf8"),
);
const files = [...new Set(exercises.flatMap((e) => e.images))];
let index = 0,
  success = 0,
  failed = [];
async function worker() {
  while (index < files.length) {
    const image = files[index++],
      target = path.join("public/exercises", image);
    if (fs.existsSync(target)) {
      success++;
      continue;
    }
    let downloaded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${image}`,
          { signal: AbortSignal.timeout(25000) },
        );
        if (!res.ok) throw Error(`${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length < 100) throw Error("Empty media");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
        downloaded = true;
        success++;
        break;
      } catch (err) {
        if (attempt === 2) console.log(`Failed: ${image}: ${err.message}`);
      }
    }
    if (!downloaded) failed.push(image);
    if ((success + failed.length) % 100 === 0)
      console.log(
        `${success} downloaded / ${files.length}, ${failed.length} failures`,
      );
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
fs.writeFileSync(
  "public/media-report.json",
  JSON.stringify({ total: files.length, downloaded: success, failed }, null, 2),
);
console.log(`${success}/${files.length} images available locally.`);
if (failed.length) process.exitCode = 1;
