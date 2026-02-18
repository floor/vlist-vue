// build.ts - Build vlist-vue
import { $ } from "bun";

const isDev = process.argv.includes("--watch");

async function build() {
  const start = performance.now();
  console.log("🔨 Building @floor/vlist-vue...\n");

  // Build the Vue composable
  const buildResult = await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    format: "esm",
    target: "browser",
    minify: !isDev,
    sourcemap: isDev ? "inline" : "none",
    naming: "index.js",
    external: ["vue", "@floor/vlist"],
  });

  if (!buildResult.success) {
    console.error("\n❌ Build failed:\n");
    for (const log of buildResult.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const file = Bun.file("./dist/index.js");
  const size = (file.size / 1024).toFixed(1);
  const buildTime = performance.now() - start;

  console.log(`  Build       ${buildTime.toFixed(0).padStart(6)}ms  ${size} KB`);
  
  // Generate types
  const dtsStart = performance.now();
  const tsc = await $`bunx tsc --emitDeclarationOnly`.quiet().nothrow();
  if (tsc.exitCode !== 0) {
    console.error("\n⚠️  TypeScript generation failed (skipping types)");
  } else {
    const dtsTime = performance.now() - dtsStart;
    console.log(`  Types       ${dtsTime.toFixed(0).padStart(6)}ms  dist/index.d.ts`);
  }

  // Gzip size
  const gzipBytes = await $`gzip -c dist/index.js | wc -c`.quiet().text();
  const gzipSize = (parseInt(gzipBytes.trim(), 10) / 1024).toFixed(1);
  
  console.log(`\n  📦 ${size} KB minified, ${gzipSize} KB gzipped`);
  console.log(`\n✨ Done in ${(performance.now() - start).toFixed(0)}ms`);
}

if (isDev) {
  console.log("👀 Watching for changes...\n");
  const { watch } = await import("fs");
  watch("./src", { recursive: true }, async (_event, filename) => {
    if (filename && !filename.includes("node_modules")) {
      console.log(`\n📝 ${filename} changed\n`);
      await build();
    }
  });
  await build();
} else {
  await build();
}
