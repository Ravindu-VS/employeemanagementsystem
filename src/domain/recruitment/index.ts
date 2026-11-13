/**
 * =====================================================
 * RECRUITMENT — skill extraction, matching, ranking
 * =====================================================
 * Explainable keyword matching (no black box). It RANKS candidates for a
 * human; it never rejects anyone. Stage changes always need a person, and a
 * rejection needs a written reason.
 */

import type { Candidate, CandidateStage, JobPosting } from '@/types';

/** Construction / architectural-services skill vocabulary with synonyms. */
export const SKILL_VOCABULARY: Record<string, string[]> = {
  masonry: ['masonry', 'mason', 'bricklaying', 'brick laying', 'block work', 'blockwork'],
  carpentry: ['carpentry', 'carpenter', 'formwork', 'shuttering', 'joinery'],
  plumbing: ['plumbing', 'plumber', 'pipe fitting', 'pipefitting'],
  electrical: ['electrical', 'electrician', 'wiring'],
  welding: ['welding', 'welder', 'arc welding', 'mig', 'tig'],
  tiling: ['tiling', 'tiler', 'tile work', 'tile laying'],
  painting: ['painting', 'painter', 'plastering', 'plaster'],
  'steel fixing': ['steel fixing', 'steel fixer', 'rebar', 'bar bending'],
  concrete: ['concrete', 'concreting', 'casting'],
  scaffolding: ['scaffolding', 'scaffold'],
  surveying: ['surveying', 'surveyor', 'levelling', 'leveling', 'total station'],
  autocad: ['autocad', 'auto cad', 'cad drafting'],
  revit: ['revit', 'bim'],
  sketchup: ['sketchup', 'sketch up'],
  'architectural drawing': ['architectural drawing', 'draughtsman', 'draftsman', 'drafting', 'working drawings'],
  estimating: ['estimating', 'quantity surveying', 'boq', 'bill of quantities', 'costing'],
  supervision: ['supervision', 'supervisor', 'site supervisor', 'foreman', 'team lead'],
  safety: ['safety', 'health and safety', 'hse', 'osh'],
  'first aid': ['first aid'],
  'heavy vehicle licence': ['heavy vehicle', 'heavy licence', 'heavy license', 'lorry driver', 'truck driver'],
  'light vehicle licence': ['light vehicle', 'driving licence', 'driving license', 'van driver', 'driver'],
  'machine operation': ['excavator', 'backhoe', 'jcb', 'roller', 'crane', 'machine operator'],
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** Skills (canonical names) mentioned in free text. */
export function extractSkills(text: string, extraSkills: string[] = []): string[] {
  const t = norm(text || '');
  const found = new Set<string>();
  for (const [skill, synonyms] of Object.entries(SKILL_VOCABULARY)) {
    if (synonyms.some((syn) => t.includes(norm(syn)))) found.add(skill);
  }
  for (const s of extraSkills) {
    const key = s.toLowerCase().trim();
    if (key && t.includes(norm(key))) found.add(key);
  }
  return Array.from(found).sort();
}

/** Years of experience mentioned in text ("5 years", "3+ yrs"), largest value. */
export function extractExperienceYears(text: string): number {
  const m = Array.from((text || '').toLowerCase().matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/g)).map((x) => Number(x[1]));
  return m.length ? Math.max(...m) : 0;
}

export interface MatchResult {
  score: number; // 0–100
  matchedRequired: string[];
  missingRequired: string[];
  matchedNice: string[];
  experienceOk: boolean;
  explanation: string;
}

/**
 * Score = 70 × required-skill coverage + 20 × nice-to-have coverage
 *       + 10 if experience ≥ minimum (proportional below it).
 */
export function scoreCandidate(skills: string[], experienceYears: number, job: Pick<JobPosting, 'requiredSkills' | 'niceToHaveSkills' | 'minExperienceYears'>): MatchResult {
  const have = new Set(skills.map((s) => s.toLowerCase()));
  const req = job.requiredSkills.map((s) => s.toLowerCase());
  const nice = job.niceToHaveSkills.map((s) => s.toLowerCase());
  const matchedRequired = req.filter((s) => have.has(s));
  const missingRequired = req.filter((s) => !have.has(s));
  const matchedNice = nice.filter((s) => have.has(s));
  const reqPart = req.length ? matchedRequired.length / req.length : 1;
  const nicePart = nice.length ? matchedNice.length / nice.length : 1;
  const min = Math.max(0, job.minExperienceYears || 0);
  const expPart = min === 0 ? 1 : Math.min(1, experienceYears / min);
  const score = Math.round(70 * reqPart + 20 * nicePart + 10 * expPart);
  const explanation = [
    `${matchedRequired.length}/${req.length} required skills`,
    `${matchedNice.length}/${nice.length} nice-to-have`,
    `${experienceYears} yrs experience${min ? ` (min ${min})` : ''}`,
  ].join(' · ');
  return { score, matchedRequired, missingRequired, matchedNice, experienceOk: experienceYears >= min, explanation };
}

/** Highest score first; ties by experience then name. Never filters anyone out. */
export function rankCandidates<T extends Pick<Candidate, 'matchScore' | 'experienceYears' | 'name'>>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => b.matchScore - a.matchScore || b.experienceYears - a.experienceYears || a.name.localeCompare(b.name));
}

const FLOW: Record<CandidateStage, CandidateStage[]> = {
  applied: ['screening', 'rejected'],
  screening: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: ['screening'], // a person may reconsider
};

/** Validates a human stage change. Returns an error message or null. */
export function validateStageChange(from: CandidateStage, to: CandidateStage, actorUid: string | undefined, reason?: string): string | null {
  if (!actorUid) return 'A signed-in person must make this decision';
  if (!FLOW[from].includes(to)) return `Cannot move from ${from} to ${to}`;
  if (to === 'rejected' && !(reason && reason.trim().length >= 5)) return 'A rejection needs a written reason (human review required)';
  return null;
}

export const nextStages = (from: CandidateStage) => FLOW[from];
