/**
 * =====================================================
 * HR ASSISTANT — retrieval (RAG, client-side)
 * =====================================================
 * Documents are split into passages and ranked with BM25. The top passages
 * are the only material an answer may use, and every answer cites them.
 */

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
}

export interface Passage {
  docId: string;
  title: string;
  text: string;
  score: number;
}

const STOP = new Set('a an and are as at be by can do does for from has have how i if in is it its me my of on or our so that the their them then there this to was we what when where which who why will with you your am did get got any much many should would could'.split(' '));

export function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

/** Split into paragraph passages of at most ~maxChars, keeping sentences whole. */
export function chunk(doc: KnowledgeDoc, maxChars = 600): Array<{ docId: string; title: string; text: string }> {
  const paras = doc.content.split(/\n\s*\n|\n(?=[-*•]\s)/).map((p) => p.trim()).filter(Boolean);
  const out: Array<{ docId: string; title: string; text: string }> = [];
  let cur = '';
  const push = () => { if (cur.trim()) out.push({ docId: doc.id, title: doc.title, text: cur.trim() }); cur = ''; };
  for (const p of paras) {
    if (p.length > maxChars) {
      push();
      const sentences = p.match(/[^.!?]+[.!?]*/g) || [p];
      for (const s of sentences) {
        if ((cur + ' ' + s).length > maxChars) push();
        cur += (cur ? ' ' : '') + s.trim();
      }
      push();
    } else if ((cur + '\n' + p).length > maxChars) {
      push();
      cur = p;
    } else {
      cur += (cur ? '\n' : '') + p;
    }
  }
  push();
  return out;
}

/** BM25 (k1 = 1.4, b = 0.75). Title words count double. */
export function search(docs: KnowledgeDoc[], query: string, k = 3): Passage[] {
  const q = Array.from(new Set(tokenize(query)));
  if (!q.length) return [];
  const passages = docs.flatMap((d) => chunk(d));
  const toks = passages.map((p) => [...tokenize(p.text), ...tokenize(p.title), ...tokenize(p.title)]);
  const N = passages.length;
  const avg = toks.reduce((s, t) => s + t.length, 0) / Math.max(1, N);
  const df = new Map<string, number>();
  for (const t of toks) for (const term of new Set(t)) df.set(term, (df.get(term) || 0) + 1);
  const k1 = 1.4, b = 0.75;
  return passages
    .map((p, i) => {
      const tf = new Map<string, number>();
      for (const t of toks[i]) tf.set(t, (tf.get(t) || 0) + 1);
      let score = 0;
      for (const term of q) {
        const f = tf.get(term) || 0;
        if (!f) continue;
        const n = df.get(term) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * toks[i].length) / avg)));
      }
      return { ...p, score: Math.round(score * 1000) / 1000 };
    })
    .filter((p) => p.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

/**
 * Answer without an LLM: the sentences from the top passages that share the
 * most query terms (max 3), in passage order.
 */
export function extractiveAnswer(query: string, passages: Passage[], maxSentences = 3): string {
  const q = new Set(tokenize(query));
  const scored = passages.flatMap((p, pi) =>
    (p.text.match(/[^.!?\n]+[.!?]?/g) || []).map((s, si) => ({ s: s.trim(), pi, si, hits: tokenize(s).filter((t) => q.has(t)).length }))
  ).filter((x) => x.hits > 0 && x.s.length > 3);
  const best = scored.sort((a, b) => b.hits - a.hits || a.pi - b.pi || a.si - b.si).slice(0, maxSentences).sort((a, b) => a.pi - b.pi || a.si - b.si);
  return best.map((x) => x.s.replace(/^[-*•]\s*/, '')).join(' ');
}
