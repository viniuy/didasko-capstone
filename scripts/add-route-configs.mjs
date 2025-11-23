#!/usr/bin/env node

/**
 * Script to add route segment configs to all API routes for pre-compilation
 * This prevents cold starts and improves performance
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROUTE_CONFIG = `// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
`;

function findRouteFiles(dir, fileList = []) {
  try {
    const files = readdirSync(dir);

    files.forEach((file) => {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
          findRouteFiles(filePath, fileList);
        } else if (file === "route.ts") {
          fileList.push(filePath);
        }
      } catch (e) {
        // Skip if can't read
      }
    });
  } catch (e) {
    // Skip if can't read directory
  }

  return fileList;
}

function addConfigsToRoutes() {
  const routeFiles = findRouteFiles("app/api");

  console.log(`Found ${routeFiles.length} route files\n`);

  let added = 0;
  let skipped = 0;

  for (const filePath of routeFiles) {
    try {
      const content = readFileSync(filePath, "utf8");

      // Skip if config already exists
      if (
        content.includes("export const dynamic") ||
        content.includes("export const runtime")
      ) {
        skipped++;
        continue;
      }

      // Find where to insert (after imports, before first export)
      const lines = content.split("\n");
      let insertIndex = 0;

      // Find the first export statement
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.startsWith("export") &&
          (line.includes("function") ||
            line.includes("const") ||
            line.includes("async") ||
            line.includes("GET") ||
            line.includes("POST"))
        ) {
          insertIndex = i;
          break;
        }
      }

      // If no export found, skip
      if (insertIndex === 0 && !content.includes("export")) {
        console.log(`⚠️  No export found in ${filePath}, skipping`);
        skipped++;
        continue;
      }

      // Insert config before first export
      lines.splice(insertIndex, 0, "", ...ROUTE_CONFIG.trim().split("\n"));

      const newContent = lines.join("\n");
      writeFileSync(filePath, newContent, "utf8");
      console.log(`✅ Added config to ${filePath}`);
      added++;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log(`\n✨ Done!`);
  console.log(`   ✅ Added configs to ${added} routes`);
  console.log(`   ⏭️  Skipped ${skipped} routes (already have configs)`);
}

addConfigsToRoutes();
