'use client';

/**
 * =====================================================
 * RECRUITMENT — job postings, candidate ranking, pipeline
 * =====================================================
 * Match scores are explainable keyword matches that help a person review.
 * No candidate is ever rejected automatically: every stage change is a
 * button press by a signed-in admin, and rejecting needs a written reason.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { Empty, Field, FormActions, PageHeader, Pill, Spinner, errorText, selectCls, textareaCls, type Tone } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX } from '@/domain/roles';
import { extractExperienceYears, nextStages, scoreCandidate } from '@/domain/recruitment';
import { addCandidate, getCandidates, getJobPostings, moveCandidateStage, saveJobPosting } from '@/services';
import { ROLE_OPTIONS } from '@/constants';
import type { Candidate, CandidateStage, JobPosting, UserRole } from '@/types';

type JobForm = Omit<JobPosting, 'id' | 'createdAt' | 'updatedAt'>;
const EMPTY_JOB: JobForm = { title: '', role: 'helper', description: '', requiredSkills: [], niceToHaveSkills: [], minExperienceYears: 0, status: 'open' };
const STAGE_TONE: Record<CandidateStage, Tone> = { applied: 'slate', screening: 'blue', interview: 'blue', offer: 'amber', hired: 'green', rejected: 'red' };
const splitSkills = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function RecruitmentPage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.recruitment);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<{ id?: string; data: JobForm; req: string; nice: string } | null>(null);
  const [cand, setCand] = useState<{ name: string; phone: string; email: string; experienceYears: number; resumeText: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ c: Candidate; reason: string } | null>(null);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: getJobPostings, enabled: isAuthorized });
  const job = jobs.find((j) => j.id === jobId) || null;
  const { data: candidates = [], isLoading: lc } = useQuery({ queryKey: ['candidates', jobId], queryFn: () => getCandidates(jobId!), enabled: isAuthorized && !!jobId });
  const onError = (e: unknown) => toast({ title: 'Error', description: errorText(e), variant: 'destructive' });

  const saveJob = useMutation({
    mutationFn: (f: NonNullable<typeof jobForm>) => saveJobPosting({ ...f.data, requiredSkills: splitSkills(f.req), niceToHaveSkills: splitSkills(f.nice) }, f.id),
    onSuccess: (id) => { toast({ title: 'Job saved' }); setJobForm(null); setJobId(id); qc.invalidateQueries({ queryKey: ['jobs'] }); },
    onError,
  });
  const addCand = useMutation({
    mutationFn: (c: NonNullable<typeof cand>) => addCandidate({ jobId: jobId!, ...c }),
    onSuccess: () => { toast({ title: 'Candidate added and scored' }); setCand(null); qc.invalidateQueries({ queryKey: ['candidates', jobId] }); },
    onError,
  });
  const move = useMutation({
    mutationFn: (m: { c: Candidate; to: CandidateStage; reason?: string }) => moveCandidateStage(m.c, m.to, profile?.uid, m.reason),
    onSuccess: () => { setRejecting(null); qc.invalidateQueries({ queryKey: ['candidates', jobId] }); },
    onError,
  });

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Recruitment" subtitle="Post jobs, add applicants and review them in ranked order.">
        <Button className="gap-1" onClick={() => setJobForm({ data: EMPTY_JOB, req: '', nice: '' })}><Plus className="h-4 w-4" /> New job</Button>
      </PageHeader>

      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p>Scores only sort the list — they are a keyword match against the job&apos;s skills, with the reasons shown. Nobody is rejected automatically; a person decides every step, and a rejection needs a written reason.</p>
      </div>

      {jobForm && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{jobForm.id ? 'Edit job' : 'New job'}</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); saveJob.mutate(jobForm); }}>
              <Field label="Title"><Input value={jobForm.data.title} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, title: e.target.value } })} placeholder="Mason (Bass)" /></Field>
              <Field label="Role">
                <select className={selectCls} value={jobForm.data.role} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, role: e.target.value as UserRole } })}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Minimum experience (years)"><Input type="number" min={0} value={jobForm.data.minExperienceYears} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, minExperienceYears: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
              <Field label="Required skills (comma separated)" className="sm:col-span-3"><Input value={jobForm.req} onChange={(e) => setJobForm({ ...jobForm, req: e.target.value })} placeholder="masonry, concrete" /></Field>
              <Field label="Nice to have (comma separated)" className="sm:col-span-3"><Input value={jobForm.nice} onChange={(e) => setJobForm({ ...jobForm, nice: e.target.value })} placeholder="tiling, safety" /></Field>
              <Field label="Description" className="sm:col-span-3"><textarea className={textareaCls} value={jobForm.data.description} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, description: e.target.value } })} /></Field>
              <Field label="Daily rate offered (LKR)"><Input type="number" min={0} value={jobForm.data.dailyRateOffered ?? ''} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, dailyRateOffered: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) } })} /></Field>
              <Field label="Status">
                <select className={selectCls} value={jobForm.data.status} onChange={(e) => setJobForm({ ...jobForm, data: { ...jobForm.data, status: e.target.value as JobPosting['status'] } })}>
                  <option value="open">Open</option><option value="closed">Closed</option>
                </select>
              </Field>
              <FormActions onCancel={() => setJobForm(null)} pending={saveJob.isPending} className="items-end sm:col-span-1" />
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {isLoading ? <Spinner /> : jobs.length === 0 ? <Empty text="No jobs yet" /> : jobs.map((j) => (
              <button key={j.id} onClick={() => setJobId(j.id)} className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60 ${j.id === jobId ? 'bg-muted' : ''}`}>
                <span className="flex items-center gap-2 truncate"><Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />{j.title}</span>
                <Pill tone={j.status === 'open' ? 'green' : 'slate'}>{j.status}</Pill>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!job ? <Card><CardContent><Empty text="Choose a job to see its candidates" /></CardContent></Card> : (
            <>
              <Card>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">Required: {job.requiredSkills.join(', ') || '—'} · Nice: {job.niceToHaveSkills.join(', ') || '—'} · Min {job.minExperienceYears} yrs</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setJobForm({ id: job.id, data: { title: job.title, role: job.role, description: job.description, requiredSkills: job.requiredSkills, niceToHaveSkills: job.niceToHaveSkills, minExperienceYears: job.minExperienceYears, status: job.status, ...(job.dailyRateOffered !== undefined ? { dailyRateOffered: job.dailyRateOffered } : {}), ...(job.siteId ? { siteId: job.siteId } : {}) }, req: job.requiredSkills.join(', '), nice: job.niceToHaveSkills.join(', ') })}>Edit job</Button>
                    <Button size="sm" className="gap-1" onClick={() => setCand({ name: '', phone: '', email: '', experienceYears: 0, resumeText: '' })}><UserPlus className="h-4 w-4" /> Add candidate</Button>
                  </div>
                </CardContent>
              </Card>

              {cand && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">New candidate</CardTitle></CardHeader>
                  <CardContent>
                    <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); addCand.mutate(cand); }}>
                      <Field label="Name"><Input value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} /></Field>
                      <Field label="Phone"><Input value={cand.phone} onChange={(e) => setCand({ ...cand, phone: e.target.value })} /></Field>
                      <Field label="Email"><Input type="email" value={cand.email} onChange={(e) => setCand({ ...cand, email: e.target.value })} /></Field>
                      <Field label="Experience (years)"><Input type="number" min={0} value={cand.experienceYears} onChange={(e) => setCand({ ...cand, experienceYears: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                      <Field label="CV / application text" className="sm:col-span-4">
                        <textarea className={textareaCls} value={cand.resumeText} onChange={(e) => { const t = e.target.value; setCand({ ...cand, resumeText: t, experienceYears: cand.experienceYears || extractExperienceYears(t) }); }} placeholder="Paste the CV or write what the applicant told you" />
                      </Field>
                      <FormActions onCancel={() => setCand(null)} pending={addCand.isPending} label="Add and score" className="sm:col-span-4" />
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Candidates (ranked)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {lc ? <Spinner /> : candidates.length === 0 ? <Empty text="No candidates yet" /> : candidates.map((c, i) => {
                    const m = scoreCandidate(c.extractedSkills, c.experienceYears, job);
                    return (
                      <div key={c.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">#{i + 1} {c.name} <span className="text-xs text-muted-foreground">· {c.phone}{c.email ? ` · ${c.email}` : ''}</span></p>
                            <p className="text-xs text-muted-foreground">{m.explanation}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {m.matchedRequired.map((s) => <Pill key={s} tone="green">{s}</Pill>)}
                              {m.matchedNice.map((s) => <Pill key={s} tone="blue">{s}</Pill>)}
                              {m.missingRequired.map((s) => <Pill key={s} tone="red">missing {s}</Pill>)}
                            </div>
                            {c.stage === 'rejected' && c.rejectionReason && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Reason: {c.rejectionReason}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-2xl font-bold tabular-nums text-foreground">{c.matchScore}</span>
                            <Pill tone={STAGE_TONE[c.stage]}>{c.stage}</Pill>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {nextStages(c.stage).filter((s) => s !== 'rejected').map((s) => (
                            <Button key={s} size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate({ c, to: s })} className="capitalize">Move to {s}</Button>
                          ))}
                          {nextStages(c.stage).includes('rejected') && (
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setRejecting({ c, reason: '' })}>Reject…</Button>
                          )}
                        </div>
                        {rejecting?.c.id === c.id && (
                          <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); move.mutate({ c, to: 'rejected', reason: rejecting.reason }); }}>
                            <Input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ c, reason: e.target.value })} placeholder="Why? (shown in the audit log)" />
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
                              <Button type="submit" variant="destructive" disabled={rejecting.reason.trim().length < 5 || move.isPending}>Confirm reject</Button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
