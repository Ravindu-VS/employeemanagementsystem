import { describe, it, expect } from 'vitest';
import { extractSkills, extractExperienceYears, scoreCandidate, rankCandidates, validateStageChange, nextStages } from './index';

const job = { requiredSkills: ['masonry', 'concrete'], niceToHaveSkills: ['tiling', 'safety'], minExperienceYears: 4 };

describe('recruitment', () => {
  it('extracts canonical skills from free text and synonyms', () => {
    const s = extractSkills('Experienced Mason, did block work and concreting. Tile laying too. Knows AutoCAD.');
    expect(s).toEqual(['autocad', 'concrete', 'masonry', 'tiling']);
  });
  it('does not match partial words', () => {
    expect(extractSkills('masonite boards')).toEqual([]);
  });
  it('includes job-specific extra skills', () => {
    expect(extractSkills('can do waterproofing', ['Waterproofing'])).toEqual(['waterproofing']);
  });
  it('reads experience years', () => {
    expect(extractExperienceYears('3 years at X, then 6+ yrs at Y')).toBe(6);
    expect(extractExperienceYears('fresh')).toBe(0);
  });
  it('scores transparently', () => {
    const full = scoreCandidate(['masonry', 'concrete', 'tiling', 'safety'], 5, job);
    expect(full.score).toBe(100);
    const half = scoreCandidate(['masonry'], 2, job);
    // 70*0.5 + 20*0 + 10*0.5
    expect(half.score).toBe(40);
    expect(half.missingRequired).toEqual(['concrete']);
    expect(half.experienceOk).toBe(false);
    expect(half.explanation).toContain('1/2 required');
  });
  it('ranks without dropping anyone', () => {
    const list = [
      { name: 'B', matchScore: 40, experienceYears: 1 },
      { name: 'A', matchScore: 90, experienceYears: 1 },
      { name: 'C', matchScore: 40, experienceYears: 5 },
      { name: 'D', matchScore: 0, experienceYears: 0 },
    ];
    expect(rankCandidates(list).map((c) => c.name)).toEqual(['A', 'C', 'B', 'D']);
  });
  it('never auto-rejects: needs a person and a reason', () => {
    expect(validateStageChange('applied', 'rejected', undefined, 'not a fit')).toMatch(/signed-in person/);
    expect(validateStageChange('applied', 'rejected', 'u1')).toMatch(/reason/);
    expect(validateStageChange('applied', 'rejected', 'u1', 'No masonry experience')).toBeNull();
    expect(validateStageChange('applied', 'hired', 'u1')).toMatch(/Cannot move/);
    expect(validateStageChange('offer', 'hired', 'u1')).toBeNull();
    expect(nextStages('hired')).toEqual([]);
  });
});
