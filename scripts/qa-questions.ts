/**
 * Item-writing QA over the question bank.
 *
 *   npx tsx scripts/qa-questions.ts            # whole bank
 *   npx tsx scripts/qa-questions.ts questions-cg-d5.json   # one batch
 *
 * Catches the cues that let a test-taker pick the right option without knowing
 * the material. The big one is **length**: if the correct option is reliably
 * the longest, the bank teaches "pick the wordy one" rather than the content.
 * Everything here is a heuristic, so findings are ranked and printed, never
 * auto-fixed — a flagged item may still be fine.
 *
 * Exit code is 1 if any ERROR-level finding fires, so this can gate a commit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, "seed/generated");

interface Option {
  label: string;
  body: string;
  is_correct: boolean;
  rationale: string | null;
}
interface Question {
  id: string;
  task_code: string | null;
  domain: number;
  scenario: string | null;
  stem: string;
  type: string;
  difficulty: number;
  explanation: string | null;
  options: Option[];
}

type Level = "ERROR" | "WARN";
interface Finding {
  level: Level;
  code: string;
  id: string;
  detail: string;
}

/**
 * Unconditional qualifiers. One of these in one distractor is ordinary
 * technical writing — "never commit secrets" is just true. The cue only exists
 * when *every* distractor carries one and the key doesn't, which is what the
 * check below actually tests. Bare "all"/"only"/"none" are excluded: they are
 * common determiners here and firing on them buries the signal.
 */
const ABSOLUTES =
  /\b(always|never|every single|in every case|in all cases|under no circumstances|impossible|guaranteed|regardless of)\b/i;
/** Words that make an option read as true regardless of its content. */
const HEDGES =
  /\b(usually|generally|typically|often|in most cases|tends to|can help|may help)\b/i;
const NONSENSE_OPTIONS = /\b(all|none) of the above\b/i;

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

function findings(q: Question): Finding[] {
  const out: Finding[] = [];
  const push = (level: Level, code: string, detail: string) =>
    out.push({ level, code, id: q.id, detail });

  const correct = q.options.filter((o) => o.is_correct);
  const wrong = q.options.filter((o) => !o.is_correct);

  // ── Structural ──────────────────────────────────────────
  if (q.options.length < 4)
    push("ERROR", "too-few-options", `${q.options.length} options`);
  if (q.type === "single" && correct.length !== 1)
    push("ERROR", "key-count", `${correct.length} correct on a single-answer item`);
  if (q.type === "multi" && correct.length < 2)
    push("ERROR", "key-count", `${correct.length} correct on a multi-answer item`);
  for (const o of q.options)
    if (!o.rationale?.trim())
      push("ERROR", "no-rationale", `option ${o.label} has no rationale`);
  if (!q.task_code) push("ERROR", "untagged-task", "no task_code");
  if (!q.scenario) push("WARN", "untagged-scenario", "no scenario");
  if (q.task_code && Number(q.task_code.split(".")[0]) !== q.domain)
    push("ERROR", "task-domain-mismatch", `${q.task_code} tagged domain ${q.domain}`);

  // ── Length cue ──────────────────────────────────────────
  // The classic tell. Flagged when the key is longest AND clears the longest
  // distractor by a real margin — being longest by a few characters is noise.
  if (correct.length === 1 && wrong.length > 0) {
    const key = correct[0].body.length;
    const longestWrong = Math.max(...wrong.map((o) => o.body.length));
    const meanWrong =
      wrong.reduce((a, o) => a + o.body.length, 0) / wrong.length;
    if (key > longestWrong && key >= meanWrong * 1.4)
      push(
        "ERROR",
        "key-longest",
        `key ${key} chars vs longest distractor ${longestWrong}, mean ${Math.round(meanWrong)}`
      );
    else if (key > longestWrong && key >= meanWrong * 1.2)
      push(
        "WARN",
        "key-longish",
        `key ${key} chars vs longest distractor ${longestWrong}, mean ${Math.round(meanWrong)}`
      );
    // The inverse is a cue too: a conspicuously stubby key.
    const shortestWrong = Math.min(...wrong.map((o) => o.body.length));
    if (key < shortestWrong && key <= meanWrong * 0.55)
      push(
        "WARN",
        "key-shortest",
        `key ${key} chars vs shortest distractor ${shortestWrong}`
      );
  }

  // ── Wording cues ────────────────────────────────────────
  for (const o of q.options)
    if (NONSENSE_OPTIONS.test(o.body))
      push("ERROR", "all-of-the-above", `option ${o.label}`);

  // Every distractor is unconditional and the key isn't: the item can be
  // answered by eliminating overclaims, without reading for content.
  if (correct.length === 1 && wrong.length > 1) {
    const allWrongAbsolute = wrong.every((o) => ABSOLUTES.test(o.body));
    if (allWrongAbsolute && !ABSOLUTES.test(correct[0].body))
      push(
        "WARN",
        "absolutes-eliminable",
        `all ${wrong.length} distractors carry an unconditional qualifier, key does not`
      );
    if (HEDGES.test(correct[0].body) && !wrong.some((o) => HEDGES.test(o.body)))
      push(
        "WARN",
        "hedge-in-key",
        `only the key hedges: "${correct[0].body.slice(0, 70)}"`
      );
  }

  // ── Clang cue: key echoes the stem's vocabulary hardest ──
  if (correct.length === 1 && wrong.length > 0) {
    const stemWords = new Set(words(q.stem));
    const overlap = (o: Option) =>
      words(o.body).filter((w) => stemWords.has(w)).length;
    const keyOverlap = overlap(correct[0]);
    const maxWrong = Math.max(...wrong.map(overlap));
    if (keyOverlap >= 3 && keyOverlap > maxWrong + 1)
      push(
        "WARN",
        "stem-echo",
        `key repeats ${keyOverlap} stem words, best distractor ${maxWrong}`
      );
  }

  // ── Near-duplicate options ──────────────────────────────
  for (let i = 0; i < q.options.length; i++)
    for (let j = i + 1; j < q.options.length; j++) {
      const a = new Set(words(q.options[i].body));
      const b = words(q.options[j].body);
      if (a.size === 0 || b.length === 0) continue;
      const shared = b.filter((w) => a.has(w)).length;
      if (shared / Math.max(a.size, b.length) > 0.8)
        push(
          "WARN",
          "near-duplicate",
          `options ${q.options[i].label}/${q.options[j].label} overlap heavily`
        );
    }

  // ── Rationale leakage ───────────────────────────────────
  // Distractor rationales that only say "wrong" teach nothing.
  for (const o of wrong)
    if ((o.rationale ?? "").trim().length < 25)
      push("WARN", "thin-rationale", `option ${o.label}: "${o.rationale}"`);

  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const files = (
    argv.length
      ? argv.map((f) => (f.endsWith(".json") ? f : `${f}.json`))
      : readdirSync(DIR).filter(
          (f) => f.startsWith("questions") && f.endsWith(".json")
        )
  ).sort();

  const all: Question[] = [];
  for (const f of files)
    all.push(...(JSON.parse(readFileSync(resolve(DIR, f), "utf8")) as Question[]));

  const seen = new Map<string, string>();
  const results: Finding[] = [];
  for (const q of all) {
    if (seen.has(q.id))
      results.push({
        level: "ERROR",
        code: "duplicate-id",
        id: q.id,
        detail: "id appears twice in the bank",
      });
    seen.set(q.id, q.stem);
    results.push(...findings(q));
  }

  // Bank-level: is the key systematically the longest option?
  let keyLongest = 0;
  let scored = 0;
  for (const q of all) {
    const c = q.options.filter((o) => o.is_correct);
    const w = q.options.filter((o) => !o.is_correct);
    if (c.length !== 1 || w.length === 0) continue;
    scored++;
    if (c[0].body.length > Math.max(...w.map((o) => o.body.length))) keyLongest++;
  }

  const errors = results.filter((r) => r.level === "ERROR");
  const warns = results.filter((r) => r.level === "WARN");

  const byCode = new Map<string, Finding[]>();
  for (const r of results) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);

  console.log(`\n  ${all.length} questions from ${files.length} file(s)\n`);
  console.log(
    `  key is longest option: ${keyLongest}/${scored} (${Math.round(
      (keyLongest / scored) * 100
    )}%) — chance is ~25%\n`
  );

  for (const [code, rows] of [...byCode.entries()].sort(
    (a, b) =>
      (a[1][0].level === "ERROR" ? 0 : 1) - (b[1][0].level === "ERROR" ? 0 : 1) ||
      b[1].length - a[1].length
  )) {
    console.log(`  ${rows[0].level}  ${code}  ×${rows.length}`);
    for (const r of rows.slice(0, 6))
      console.log(`      ${r.id.slice(-6)}  ${r.detail}`);
    if (rows.length > 6) console.log(`      … ${rows.length - 6} more`);
    console.log();
  }

  console.log(`  ${errors.length} error(s), ${warns.length} warning(s)\n`);
  process.exit(errors.length ? 1 : 0);
}

main();
