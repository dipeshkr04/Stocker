import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { config } from "./config.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(currentDirectory, "../../../database/migrations");
const pool = new Pool({ connectionString: config.databaseUrl, max: config.databasePoolMax });
const files = (await fs.readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  await pool.query(await fs.readFile(path.join(migrationDirectory, file), "utf8"));
  console.log(`Applied ${file}`);
}
await pool.end();
