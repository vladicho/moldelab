const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const staticFiles = ["index.html", "login.html", "admin.html", "mobile-scanner.html", "styles.css"];
const jsEntries = ["app.js", "login.js", "admin.js", "mobile-scanner.js"];

async function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  await esbuild.build({
    entryPoints: jsEntries.map((file) => path.join(root, file)),
    outdir: dist,
    bundle: true,
    minify: true,
    legalComments: "none",
    target: ["es2020"],
    format: "iife",
    sourcemap: false,
    drop: ["console", "debugger"],
    logLevel: "info",
  });

  for (const file of staticFiles) {
    fs.copyFileSync(path.join(root, file), path.join(dist, file));
  }

  console.log(`Frontend de producao gerado em ${dist}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
