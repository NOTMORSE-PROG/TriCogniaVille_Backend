import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { teachers, badges } from "./schema";
import { BADGE_DEFINITIONS } from "./badge-definitions";
import { eq } from "drizzle-orm";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const email = process.env.TEACHER_SEED_EMAIL || "teacher@tricogniaville.com";
  const password = process.env.TEACHER_SEED_PASSWORD || "TricogniaTeacher2026!";
  const name = "Default Teacher";

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  try {
    // Check if teacher already exists
    const existing = await db
      .select()
      .from(teachers)
      .where(eq(teachers.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Teacher account already exists: ${email}`);
    } else {

      const passwordHash = await hash(password, 12);

      await db.insert(teachers).values({
        email,
        passwordHash,
        name,
      });
      console.log(`Seeded teacher account: ${email}`);
    }
  } catch (error) {
    console.error("Failed to seed teacher account:", error);
    process.exit(1);
  }

  // Seed badge definitions (idempotent)
  try {
    for (const badge of BADGE_DEFINITIONS) {
      await db.insert(badges).values(badge).onConflictDoNothing();
    }
    console.log(`Seeded ${BADGE_DEFINITIONS.length} badge definitions`);
  } catch (error) {
    console.error("Failed to seed badge definitions:", error);
    process.exit(1);
  }
}

seed();
