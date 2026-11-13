/**
 * =====================================================
 * RECRUITMENT SERVICE (job postings & candidates)
 * =====================================================
 * Scores and ranks for a human reviewer. Nothing here rejects a candidate on
 * its own — every stage change goes through moveCandidateStage, which needs a
 * signed-in person (and a reason to reject).
 */

import { where } from 'firebase/firestore';
import { createDocument, getDocuments, updateDocument, getDocument } from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { auditAction } from './audit-service';
import { extractSkills, scoreCandidate, validateStageChange, rankCandidates } from '@/domain/recruitment';
import type { Candidate, CandidateStage, JobPosting } from '@/types';

export async function getJobPostings(): Promise<JobPosting[]> {
  const jobs = await getDocuments<JobPosting>(COLLECTIONS.JOB_POSTINGS);
  return jobs.sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title) : a.status === 'open' ? -1 : 1));
}

export async function saveJobPosting(data: Omit<JobPosting, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
  if (!data.title.trim()) throw new Error('Job title is required');
  if (data.minExperienceYears < 0) throw new Error('Experience cannot be negative');
  const clean = {
    ...data,
    requiredSkills: data.requiredSkills.map((s) => s.trim().toLowerCase()).filter(Boolean),
    niceToHaveSkills: data.niceToHaveSkills.map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
  if (id) {
    await updateDocument<JobPosting>(COLLECTIONS.JOB_POSTINGS, id, clean);
    await auditAction('update', 'jobPostings', id, { newValue: { title: clean.title, status: clean.status } });
    return id;
  }
  const newId = await createDocument<JobPosting>(COLLECTIONS.JOB_POSTINGS, clean as Omit<JobPosting, 'id'>);
  await auditAction('create', 'jobPostings', newId, { newValue: { title: clean.title } });
  return newId;
}

export async function getCandidates(jobId: string): Promise<Candidate[]> {
  const all = await getDocuments<Candidate>(COLLECTIONS.CANDIDATES, [where('jobId', '==', jobId)]);
  return rankCandidates(all);
}

export interface NewCandidate {
  jobId: string;
  name: string;
  phone: string;
  email?: string;
  experienceYears: number;
  resumeText: string;
  notes?: string;
}

/** Adds a candidate with extracted skills and an explainable match score. */
export async function addCandidate(input: NewCandidate): Promise<string> {
  if (!input.name.trim()) throw new Error('Candidate name is required');
  const job = await getDocument<JobPosting>(COLLECTIONS.JOB_POSTINGS, input.jobId);
  if (!job) throw new Error('Job posting not found');
  const extractedSkills = extractSkills(input.resumeText, [...job.requiredSkills, ...job.niceToHaveSkills]);
  const { score } = scoreCandidate(extractedSkills, input.experienceYears, job);
  const id = await createDocument<Candidate>(COLLECTIONS.CANDIDATES, {
    ...input,
    extractedSkills,
    matchScore: score,
    stage: 'applied',
  } as Omit<Candidate, 'id'>);
  await auditAction('create', 'candidates', id, { newValue: { name: input.name, jobId: input.jobId, matchScore: score } });
  return id;
}

/** Human decision only. */
export async function moveCandidateStage(candidate: Candidate, to: CandidateStage, actorUid: string | undefined, reason?: string): Promise<void> {
  const err = validateStageChange(candidate.stage, to, actorUid, reason);
  if (err) throw new Error(err);
  await updateDocument<Candidate>(COLLECTIONS.CANDIDATES, candidate.id, {
    stage: to,
    stageChangedBy: actorUid,
    ...(to === 'rejected' ? { rejectionReason: reason!.trim() } : {}),
  });
  await auditAction(to === 'rejected' ? 'reject' : 'update', 'candidates', candidate.id, {
    oldValue: { stage: candidate.stage },
    newValue: { stage: to, ...(reason ? { reason } : {}) },
  });
}
