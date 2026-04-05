import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  try {
    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "./src/lib/db/migrations" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
