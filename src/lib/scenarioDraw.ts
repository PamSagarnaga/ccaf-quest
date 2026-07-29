"use client";
/**
 * Domain-balanced draw for a scenario drill.
 *
 * The point of a scenario drill is coverage: the exam tests a scenario across
 * every domain it spans, so a drill that happens to serve twelve Domain 3
 * questions for Code Generation has taught nothing about the Domain 5 half.
 * A plain shuffle does exactly that whenever the bank is lopsided, which it
 * always is — Code Generation holds 34 D3 questions against 6 in D5.
 *
 * So the quota is computed first, per domain, and the questions are drawn to
 * fill it:
 *
 *   1. Every primary domain with stock gets at least one slot. This is a floor,
 *      not a target — coverage is the whole feature, so it outranks weighting.
 *   2. The remainder is split by blueprint exam weight, renormalised over just
 *      the domains this scenario touches, by largest remainder.
 *   3. No domain is allocated more than it has in stock; anything left over
 *      spills to domains that can still absorb it.
 *
 * Incidental domains (tagged to this scenario but not in its `primary_domains`)
 * compete for the remainder but get no floor — they're flavour, not syllabus.
 *
 * `allocate` is pure and separately tested; `drawScenarioSet` layers the
 * unseen-preferring pick on top, per domain, so freshness is tracked per
 * scenario-domain rather than globally.
 */
import { domainByNumber } from "@/lib/blueprint";
import { pickUnseen } from "@/lib/seen";
import type { QuizQuestion } from "@/lib/quiz-types";

/**
 * How many questions each domain should contribute.
 *
 * `stock` is domain → questions available. Domains with no stock never appear
 * in the result — a caller that needs to tell the user "this domain is empty"
 * should compare against the scenario's primary list itself, because a silent
 * omission here is indistinguishable from a domain that simply wasn't asked
 * for.
 */
export function allocate(
  stock: Record<number, number>,
  count: number,
  primaryDomains: readonly number[]
): Record<number, number> {
  const present = Object.entries(stock)
    .map(([d, n]) => ({ domain: Number(d), stock: n }))
    .filter((d) => d.stock > 0)
    .sort((a, b) => a.domain - b.domain);
  if (present.length === 0 || count <= 0) return {};

  const out: Record<number, number> = {};
  const give = (domain: number, n: number) => {
    const room = stock[domain] - (out[domain] ?? 0);
    const take = Math.max(0, Math.min(n, room));
    if (take > 0) out[domain] = (out[domain] ?? 0) + take;
    return take;
  };

  // 1. Floor of one per primary domain that has stock, while budget allows.
  let left = count;
  for (const d of present) {
    if (left === 0) break;
    if (!primaryDomains.includes(d.domain)) continue;
    left -= give(d.domain, 1);
  }

  // 2. Split the remainder by renormalised blueprint weight, largest remainder.
  const weightOf = (n: number) => domainByNumber(n).weight;
  const totalWeight = present.reduce((a, d) => a + weightOf(d.domain), 0);
  if (left > 0 && totalWeight > 0) {
    const shares = present.map((d) => {
      const exact = (left * weightOf(d.domain)) / totalWeight;
      return { domain: d.domain, whole: Math.floor(exact), frac: exact % 1 };
    });
    let handed = 0;
    for (const s of shares) handed += give(s.domain, s.whole);
    left -= handed;
    for (const s of [...shares].sort((a, b) => b.frac - a.frac)) {
      if (left === 0) break;
      left -= give(s.domain, 1);
    }
  }

  // 3. Spill whatever is still unplaced (a domain hit its stock ceiling) onto
  //    whoever has room, so the drill is never short when the bank can fill it.
  for (const d of present) {
    if (left === 0) break;
    left -= give(d.domain, left);
  }

  return out;
}

export interface ScenarioDraw {
  questions: QuizQuestion[];
  /** Domain → how many made it in, for the runner to report honestly. */
  perDomain: Record<number, number>;
}

/**
 * Draw a domain-balanced set from a scenario's full pool, preferring questions
 * not recently served for that scenario-and-domain.
 */
export function drawScenarioSet(
  pool: QuizQuestion[],
  count: number,
  slug: string,
  primaryDomains: readonly number[]
): ScenarioDraw {
  const byDomain = new Map<number, QuizQuestion[]>();
  for (const q of pool)
    byDomain.set(q.domain, [...(byDomain.get(q.domain) ?? []), q]);

  const stock: Record<number, number> = {};
  for (const [d, qs] of byDomain) stock[d] = qs.length;

  const quota = allocate(stock, count, primaryDomains);
  const questions: QuizQuestion[] = [];
  const perDomain: Record<number, number> = {};

  for (const [d, n] of Object.entries(quota).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    const domain = Number(d);
    const picked = pickUnseen(
      byDomain.get(domain) ?? [],
      n,
      `scenario_${slug}_d${domain}`
    );
    questions.push(...picked);
    perDomain[domain] = picked.length;
  }

  // Interleave so the drill doesn't march through one domain at a time — the
  // real exam mixes them, and blocked practice flatters recall.
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { questions: shuffled, perDomain };
}
