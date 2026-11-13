import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: null } }));
vi.mock('@/lib/firebase/firestore', () => ({ getDocument: vi.fn() }));
import { pickChannels, sendExternal } from './external-notify';

describe('external notifications', () => {
  const n = { title: 'Advance approved', message: 'LKR 5,000 will be deducted next week.' };
  it('chooses SMS and email by settings and contact details', () => {
    expect(pickChannels({ phone: '0771234567', email: 'a@b.lk' }, { emailEnabled: true, smsEnabled: true }, n).map((m) => m.channel)).toEqual(['sms', 'email']);
    expect(pickChannels({ phone: '0771234567', email: 'a@b.lk' }, { emailEnabled: false, smsEnabled: false }, n)).toEqual([]);
    expect(pickChannels({ phone: '', email: 'a@b.lk' }, { emailEnabled: true, smsEnabled: true }, n).map((m) => m.channel)).toEqual(['email']);
    const sms = pickChannels({ phone: '0771234567', email: '' }, { emailEnabled: true, smsEnabled: true }, n)[0];
    expect(sms.message).toBe('KK & SONS: Advance approved. LKR 5,000 will be deducted next week.');
  });
  it('does nothing without an endpoint', async () => {
    expect(await sendExternal({ channel: 'sms', to: '0771234567', message: 'x' })).toBe('skipped');
  });
});
