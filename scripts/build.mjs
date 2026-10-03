import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["web/app.js", "web/worker.js"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: ["es2022"],
  sourcemap: false,
  minify: false,
  legalComments: "external",
});
for (const file of ["index.html", "styles.css"])
  await copyFile(`web/${file}`, `dist/${file}`);
await copyFile("THIRD_PARTY_NOTICES.md", "dist/THIRD_PARTY_NOTICES.md");
console.log(
  "Built offline browser assets in dist/. No runtime CDN dependencies.",
);
