'use client';

/**
 * =====================================================
 * HR ASSISTANT — answers with sources, never guesses policy
 * =====================================================
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, BookOpen, FileText, Loader2, Pencil, Plus, Send, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { Empty, Field, FormActions, PageHeader, Pill, Spinner, errorText, selectCls, textareaCls } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX, canAccess } from '@/domain/roles';
import { BUILTIN_HR_DOCS } from '@/domain/hr-assistant';
import { askAssistant, deleteHrDocument, getHrDocuments, saveHrDocument, type AssistantAnswer } from '@/services';
import type { HrDocument } from '@/types';

type Msg = { role: 'user'; text: string } | { role: 'bot'; a: AssistantAnswer };
type DocForm = Omit<HrDocument, 'id' | 'createdAt' | 'updatedAt'>;
const SUGGESTIONS = ['How many leave days do I have left?', 'Explain my last payslip', 'How is OT calculated?', 'When is an advance deducted?', 'How much is a supervisor paid per site visit?'];

export default function AssistantPage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.hr_assistant);
  const canManage = canAccess(profile?.role, 'hr_documents_manage');
  const canSeeAdminDocs = canAccess(profile?.role, 'analytics');
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'chat' | 'docs'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ id?: string; data: DocForm } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: docs = [], isLoading } = useQuery({ queryKey: ['hr-docs', canSeeAdminDocs], queryFn: () => getHrDocuments(canSeeAdminDocs), enabled: isAuthorized });

  const ask = useMutation({
    mutationFn: (question: string) => askAssistant(question, profile!, docs.map((d) => ({ id: d.id, title: d.title, content: d.content }))),
    onSuccess: (a) => { setMsgs((m) => [...m, { role: 'bot', a }]); setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); },
    onError: (e) => setMsgs((m) => [...m, { role: 'bot', a: { answer: `Sorry, something went wrong: ${errorText(e)}`, source: 'none', citations: [] } }]),
  });
  const send = (text: string) => {
    const t = text.trim();
    if (!t || ask.isPending || !profile) return;
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    setQ('');
    ask.mutate(t);
  };
  const save = useMutation({
    mutationFn: (f: NonNullable<typeof form>) => saveHrDocument({ ...f.data, updatedBy: profile?.uid }, f.id),
    onSuccess: () => { toast({ title: 'Document saved' }); setForm(null); qc.invalidateQueries({ queryKey: ['hr-docs'] }); },
    onError: (e) => toast({ title: 'Error', description: errorText(e), variant: 'destructive' }),
  });
  const del = useMutation({
    mutationFn: deleteHrDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-docs'] }),
    onError: (e) => toast({ title: 'Error', description: errorText(e), variant: 'destructive' }),
  });

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="HR Assistant" subtitle="Ask about your pay, leave and company rules. Answers come from your own records or the HR documents, with sources.">
        <Button size="sm" variant={tab === 'chat' ? 'default' : 'outline'} className="gap-1" onClick={() => setTab('chat')}><Bot className="h-4 w-4" /> Ask</Button>
        <Button size="sm" variant={tab === 'docs' ? 'default' : 'outline'} className="gap-1" onClick={() => setTab('docs')}><BookOpen className="h-4 w-4" /> Knowledge base</Button>
      </PageHeader>

      {tab === 'chat' && (
        <Card className="flex min-h-[60vh] flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
            <div className="flex-1 space-y-3 overflow-y-auto">
              {msgs.length === 0 && (
                <div className="space-y-3 py-6 text-center">
                  <Bot className="mx-auto h-10 w-10 text-primary" />
                  <p className="text-sm text-muted-foreground">Try one of these:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => <Button key={s} size="sm" variant="outline" onClick={() => send(s)}>{s}</Button>)}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => m.role === 'user' ? (
                <div key={i} className="flex justify-end gap-2"><p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</p><User className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /></div>
              ) : (
                <div key={i} className="flex gap-2">
                  <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
                    <p className="whitespace-pre-line">{m.a.answer}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Pill tone={m.a.source === 'personal' ? 'green' : m.a.source === 'ai' ? 'blue' : m.a.source === 'none' ? 'amber' : 'slate'}>
                        {m.a.source === 'personal' ? 'from your records' : m.a.source === 'ai' ? `AI${m.a.model ? ` · ${m.a.model}` : ''}` : m.a.source === 'extractive' ? 'quoted from documents' : 'not found'}
                      </Pill>
                    </div>
                    {m.a.citations.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Sources ({m.a.citations.length})</summary>
                        <ul className="mt-1 space-y-1">{m.a.citations.map((c, j) => <li key={j} className="rounded border border-border bg-background p-2"><span className="font-medium text-foreground">[{j + 1}] {c.title}</span><br />{c.text.length > 280 ? `${c.text.slice(0, 280)}…` : c.text}</li>)}</ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {ask.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Looking it up…</div>}
              <div ref={endRef} />
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" aria-label="Question" />
              <Button type="submit" disabled={!q.trim() || ask.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
            <p className="text-[11px] text-muted-foreground">The assistant can make mistakes. Payslips and Payroll are the official figures; ask your manager about anything important.</p>
          </CardContent>
        </Card>
      )}

      {tab === 'docs' && (
        <div className="space-y-4">
          {canManage && !form && <Button className="gap-1" onClick={() => setForm({ data: { title: '', category: 'policy', content: '', audience: 'all' } })}><Plus className="h-4 w-4" /> Add document</Button>}
          {form && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{form.id ? 'Edit document' : 'New document'}</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
                  <Field label="Title"><Input value={form.data.title} onChange={(e) => setForm({ ...form, data: { ...form.data, title: e.target.value } })} /></Field>
                  <Field label="Category">
                    <select className={selectCls} value={form.data.category} onChange={(e) => setForm({ ...form, data: { ...form.data, category: e.target.value as HrDocument['category'] } })}>
                      {['policy', 'leave', 'payroll', 'safety', 'general'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Who can read it">
                    <select className={selectCls} value={form.data.audience} onChange={(e) => setForm({ ...form, data: { ...form.data, audience: e.target.value as HrDocument['audience'] } })}>
                      <option value="all">Everyone</option><option value="admins">Managers and above</option>
                    </select>
                  </Field>
                  <Field label="Content (paste the policy text; blank lines separate sections)" className="sm:col-span-3"><textarea className={`${textareaCls} min-h-[220px]`} value={form.data.content} onChange={(e) => setForm({ ...form, data: { ...form.data, content: e.target.value } })} /></Field>
                  <FormActions onCancel={() => setForm(null)} pending={save.isPending} />
                </form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Documents the assistant uses</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? <Spinner /> : (
                <>
                  {docs.map((d) => (
                    <div key={d.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate font-medium text-foreground">{d.title}</span><Pill>{d.category}</Pill>{d.audience === 'admins' && <Pill tone="amber">managers+</Pill>}</div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setForm({ id: d.id, data: { title: d.title, category: d.category, content: d.content, audience: d.audience } })}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                          <Button size="sm" variant="ghost" className="gap-1 text-red-600" disabled={del.isPending} onClick={() => del.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {BUILTIN_HR_DOCS.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-md border border-dashed border-border p-3"><FileText className="h-4 w-4 text-muted-foreground" /><span className="font-medium text-foreground">{d.title}</span><Pill tone="blue">built-in</Pill></div>
                  ))}
                  {!docs.length && <Empty text={canManage ? 'Add your HR policies so the assistant can answer from them.' : 'Your company has not added HR documents yet; built-in rules are used.'} />}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
