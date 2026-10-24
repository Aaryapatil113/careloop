import { CHUNKS, type Chunk } from "./knowledge";

/**
 * Lexical BM25 retriever with a small patient-language synonym map.
 * Patients say "throwing up", the knowledge base says "vomiting" — the map
 * closes that gap without needing an embeddings service, which keeps the demo
 * free to host and fully deterministic for evals.
 */
const SYNONYMS: Record<string, string[]> = {
  throw: ["vomiting", "nausea"],
  puke: ["vomiting", "nausea"],
  queasy: ["nausea"],
  sick: ["nausea"],
  nauseous: ["nausea"],
  poop: ["bowel", "constipation"],
  constipated: ["constipation"],
  bloated: ["bloating", "constipation"],
  water: ["fluids", "hydration"],
  drink: ["fluids", "hydration", "alcohol"],
  thirsty: ["dehydration", "hydration"],
  dizzy: ["dizziness", "dehydration"],
  wine: ["alcohol"],
  beer: ["alcohol"],
  gym: ["exercise", "resistance", "activity"],
  workout: ["exercise", "resistance", "activity"],
  lift: ["resistance", "weights", "muscle"],
  walk: ["walking", "activity"],
  muscle: ["muscle", "protein", "resistance"],
  shot: ["injection", "dose"],
  pen: ["injection", "pens"],
  forgot: ["missed", "dose"],
  skip: ["missed", "skipped"],
  increase: ["dose", "escalation"],
  stuck: ["plateau"],
  stall: ["plateau"],
  scale: ["plateau", "weight"],
  craving: ["cravings", "stress"],
  cravings: ["stress", "eating"],
  tired: ["fatigue", "sleep"],
  shaky: ["shakiness", "low", "blood", "sugar"],
  sugar: ["glucose", "blood"],
  eat: ["meal", "meals", "eating"],
  food: ["meal", "meals", "foods"],
  hungry: ["appetite", "hunger"],
  restaurant: ["eating", "out"],
  pooped: ["bowel", "constipation"],
  inject: ["injection", "sites"],
  bruised: ["injection", "sites", "redness"],
  dehydrated: ["dehydration", "hydration"],
  crave: ["cravings"],
};

const STOP = new Set(
  "a an and are as at be but by can do does for from have how i if in is it its me my of on or should so that the this to was what when will with you your im ive just get got really where know much kind keep feel about good write then not any some also make makes want need think like would could haven hasn don doesn there their they what which recommend tips tip normal ok okay help best more better lot way ways thing things try anything who am last".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function expand(query: string): string[] {
  const raw = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  const extra = raw.flatMap((w) => SYNONYMS[w] ?? []);
  return tokenize([...raw, ...extra].join(" "));
}

interface Indexed {
  chunk: Chunk;
  tf: Map<string, number>;
  len: number;
}

const K1 = 1.4;
const B = 0.75;

const indexed: Indexed[] = CHUNKS.map((chunk) => {
  // Title terms are folded into every chunk so topical queries match.
  const tokens = tokenize(`${chunk.title} ${chunk.text}`);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { chunk, tf, len: tokens.length };
});
const avgLen = indexed.reduce((s, d) => s + d.len, 0) / indexed.length;
const df = new Map<string, number>();
for (const d of indexed) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

function idf(term: string): number {
  const n = df.get(term) ?? 0;
  return Math.log(1 + (indexed.length - n + 0.5) / (n + 0.5));
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export function retrieve(query: string, k = 5, minScore = 3): RetrievedChunk[] {
  const terms = [...new Set(expand(query))];
  if (terms.length === 0) return [];
  return indexed
    .map(({ chunk, tf, len }) => {
      let score = 0;
      for (const term of terms) {
        const f = tf.get(term);
        if (!f) continue;
        score += idf(term) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / avgLen)));
      }
      return { ...chunk, score };
    })
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Distinct documents behind a set of chunks, in rank order. */
export function topDocs(chunks: RetrievedChunk[]): { docId: string; title: string; score: number }[] {
  const seen = new Map<string, { docId: string; title: string; score: number }>();
  for (const c of chunks) if (!seen.has(c.docId)) seen.set(c.docId, { docId: c.docId, title: c.title, score: c.score });
  return [...seen.values()];
}
