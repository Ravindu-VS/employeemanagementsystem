/**
 * =====================================================
 * HR ASSISTANT SERVICE
 * =====================================================
 * 1. Personal questions ("my leave", "my payslip") → answered from the
 *    signed-in person's own records only.
 * 2. Policy questions → BM25 retrieval over built-in rules + HR documents.
 *    If NEXT_PUBLIC_AI_ENDPOINT is set, the passages go to the ai-service
 *    (FastAPI) with the user's Firebase ID token; the model may only use
 *    those passages. Otherwise an extractive answer is built locally.
 * Every policy answer lists its sources.
 */

import { where } from 'firebase/firestore';
import { createDocument, deleteDocument, getDocuments, updateDocument } from '@/lib/firebase/firestore';
import { auth } from '@/lib/firebase/client';
import { COLLECTIONS } from '@/constants';
import { auditAction } from './audit-service';
import { getMyAdvances, getMyAttendance, getMyLoans, getMyPayslips } from './self-service';
import { getEmployeeLeaveRequests, getLeaveSettings } from './leave-service';
import { BUILTIN_HR_DOCS, answerPersonal, detectIntent, extractiveAnswer, search, type KnowledgeDoc, type Passage, type PersonalData } from '@/domain/hr-assistant';
import { computeLeaveBalances } from '@/domain/leave';
import { addDaysISO, getPayrollWeek, todayISO } from '@/lib/date-utils';
import type { HrDocument, UserProfile } from '@/types';

export async function getHrDocuments(canSeeAdminDocs: boolean): Promise<HrDocument[]> {
  const docs = canSeeAdminDocs
    ? await getDocuments<HrDocument>(COLLECTIONS.HR_DOCUMENTS)
    : await getDocuments<HrDocument>(COLLECTIONS.HR_DOCUMENTS, [where('audience', '==', 'all')]);
  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

export async function saveHrDocument(data: Omit<HrDocument, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
  if (!data.title.trim() || !data.content.trim()) throw new Error('Title and content are required');
  if (data.content.length > 50000) throw new Error('Document is too long (max 50,000 characters) — split it into parts');
  if (id) {
    await updateDocument<HrDocument>(COLLECTIONS.HR_DOCUMENTS, id, data);
    await auditAction('update', 'hrDocuments', id, { newValue: { title: data.title, audience: data.audience } });
    return id;
  }
  const newId = await createDocument<HrDocument>(COLLECTIONS.HR_DOCUMENTS, data as Omit<HrDocument, 'id'>);
  await auditAction('create', 'hrDocuments', newId, { newValue: { title: data.title, audience: data.audience } });
  return newId;
}

export async function deleteHrDocument(id: string): Promise<void> {
  await deleteDocument(COLLECTIONS.HR_DOCUMENTS, id);
  await auditAction('delete', 'hrDocuments', id);
}

export interface AssistantAnswer {
  answer: string;
  source: 'personal' | 'ai' | 'extractive' | 'none';
  citations: Array<Pick<Passage, 'docId' | 'title' | 'text'>>;
  model?: string;
}

async function personalData(me: UserProfile, intent: ReturnType<typeof detectIntent>): Promise<PersonalData> {
  switch (intent) {
    case 'leave_balance': {
      const [reqs, settings] = await Promise.all([getEmployeeLeaveRequests(me.uid), getLeaveSettings()]);
      return { leaveBalances: computeLeaveBalances(reqs, todayISO().slice(0, 4), settings) };
    }
    case 'last_payslip': return { payslips: await getMyPayslips(me.uid) };
    case 'my_advances': return { advances: await getMyAdvances(me.uid) };
    case 'my_loans': return { loans: await getMyLoans(me.uid) };
    case 'my_attendance': {
      const wk = getPayrollWeek(todayISO());
      const from = addDaysISO(wk.start, -7 * 3);
      const n = await getMyAttendance(me, from, wk.end);
      const days = n.shifts.filter((s) => s.shift !== 'visit').length * 0.5;
      const visits = n.shifts.filter((s) => s.shift === 'visit').length;
      return { attendance: { from, to: wk.end, days: days + visits, otHours: n.ot.reduce((s, o) => s + o.hours, 0) } };
    }
    default: return {};
  }
}

async function askAiService(endpoint: string, question: string, passages: Passage[]): Promise<{ answer: string; model?: string } | null> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, passages: passages.map(({ docId, title, text }) => ({ doc_id: docId, title, text })) }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.answer === 'string' && j.answer.trim() ? { answer: j.answer.trim(), model: j.model } : null;
  } catch {
    return null;
  }
}

export async function askAssistant(question: string, me: UserProfile, extraDocs: KnowledgeDoc[] = []): Promise<AssistantAnswer> {
  const q = question.trim();
  if (!q) return { answer: 'Ask me about pay, OT, advances, leave or attendance.', source: 'none', citations: [] };

  const intent = detectIntent(q);
  if (intent) {
    return { answer: answerPersonal(intent, await personalData(me, intent)), source: 'personal', citations: [] };
  }

  const passages = search([...BUILTIN_HR_DOCS, ...extraDocs], q, 4);
  if (!passages.length) {
    return { answer: "I couldn't find this in the company's HR documents. Please ask your manager or HR — I don't guess about policy.", source: 'none', citations: [] };
  }
  const citations = passages.map(({ docId, title, text }) => ({ docId, title, text }));
  const endpoint = process.env.NEXT_PUBLIC_AI_ENDPOINT;
  if (endpoint) {
    const ai = await askAiService(endpoint, q, passages);
    if (ai) return { answer: ai.answer, source: 'ai', citations, ...(ai.model ? { model: ai.model } : {}) };
  }
  return { answer: extractiveAnswer(q, passages) || passages[0].text, source: 'extractive', citations };
}
