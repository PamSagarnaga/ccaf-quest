/**
 * Seed runner — loads the reference blueprint (and any generated content)
 * into Supabase using the service-role key (bypasses RLS).
 *
 *   npm run seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { domains, tasks, scenarios } from "../src/lib/blueprint";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n"
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

/** Concatenate every generated/<prefix>*.json batch file into one array. */
function loadBatches<T>(prefix: string): T[] {
  const dir = resolve(__dirname, "seed/generated");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  const out: T[] = [];
  for (const f of files) {
    const rows = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as T[];
    out.push(...rows);
  }
  return out;
}

async function upsert(table: string, rows: unknown[], onConflict: string) {
  if (!rows.length) return;
  const { error } = await db
    .from(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table.padEnd(18)} ${rows.length} rows`);
}

async function main() {
  console.log("\n▲ Seeding CCAF Quest\n");

  // ── Reference blueprint (source of truth) ──
  console.log("Reference blueprint:");
  await upsert(
    "domains",
    domains.map((d) => ({ ...d })),
    "number"
  );
  await upsert(
    "tasks",
    tasks.map((t, i) => ({ ...t, sort: i })),
    "code"
  );
  await upsert(
    "scenarios",
    scenarios.map((s) => ({ ...s, primary_domains: [...s.primary_domains] })),
    "slug"
  );

  // ── Content (generated locally; not committed) ──
  type QuestionSeed = {
    id: string;
    task_code: string | null;
    domain: number;
    scenario: string | null;
    stem: string;
    type: "single" | "multi";
    source: string;
    difficulty: number;
    explanation: string | null;
    options: {
      label: string;
      body: string;
      is_correct: boolean;
      rationale: string | null;
    }[];
  };

  const questions = loadBatches<QuestionSeed>("questions");
  if (questions?.length) {
    console.log("\nQuestions:");
    const qRows = questions.map((q) => {
      const { options, ...rest } = q;
      void options;
      return rest;
    });
    await upsert("questions", qRows, "id");
    const optRows = questions.flatMap((q) =>
      q.options.map((o, i) => ({ ...o, question_id: q.id, sort: i }))
    );
    // Replace options for these questions to stay idempotent
    await db
      .from("question_options")
      .delete()
      .in(
        "question_id",
        questions.map((q) => q.id)
      );
    await upsert("question_options", optRows, "id");
  } else {
    console.log("\n(no questions.json yet — skipping)");
  }

  const flashcards = loadBatches<Record<string, unknown>>("flashcards");
  if (flashcards?.length) {
    console.log("\nFlashcards:");
    await upsert("flashcards", flashcards, "id");
  } else {
    console.log("(no flashcards.json yet — skipping)");
  }

  console.log("\n✓ Seed complete\n");
}

main().catch((e) => {
  console.error("\n✗ Seed failed:", e.message, "\n");
  process.exit(1);
});
