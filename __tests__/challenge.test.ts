import {
  defaultChallengeConfig,
  dayOfChallenge,
  currentPhase,
  percentLoss,
  participantView,
  computeDueReminders,
  renderTemplate,
  type ChallengePhase,
} from '@/lib/challenge';
import type { ParticipantStatus } from '@prisma/client';

const D = (iso: string) => new Date(iso);
const cfg = defaultChallengeConfig();
const phases = cfg.phases;
const timing = { durationDays: cfg.durationDays, finalProofWindowDays: cfg.finalProofWindowDays, phases };

describe('defaultChallengeConfig', () => {
  it('has the 3 phases from the rules (1-30, 31-60, 61-90)', () => {
    expect(phases.map(p => [p.startDay, p.endDay])).toEqual([[1, 30], [31, 60], [61, 90]]);
  });
  it('seeds the winner tiers (1 + 10) and 14/90/14 timeline', () => {
    expect(cfg.winnerTiers.map(t => t.count)).toEqual([1, 10]);
    expect([cfg.startWindowDays, cfg.durationDays, cfg.finalProofWindowDays]).toEqual([14, 90, 14]);
  });
  it('includes the WA templates keyed by trigger', () => {
    expect(Object.keys(cfg.messageTemplates)).toEqual(expect.arrayContaining(['after_purchase', 'day1', 'day90', 'final_received']));
  });
  it('has a proof_received acknowledgement template ordered right before day1', () => {
    const keys = Object.keys(cfg.messageTemplates);
    expect(cfg.messageTemplates.proof_received).toBeTruthy();
    expect(keys.indexOf('proof_received')).toBe(keys.indexOf('day1') - 1);
  });
});

describe('dayOfChallenge (WIB calendar days, 1-based)', () => {
  const start = D('2026-06-06T10:00:00+07:00');
  it('is 1 on the start day', () => {
    expect(dayOfChallenge(start, D('2026-06-06T23:00:00+07:00'))).toBe(1);
  });
  it('counts calendar days in WIB', () => {
    expect(dayOfChallenge(start, D('2026-06-07T01:00:00+07:00'))).toBe(2);
    expect(dayOfChallenge(start, D('2026-07-05T10:00:00+07:00'))).toBe(30);
  });
  it('is null when not started', () => {
    expect(dayOfChallenge(null)).toBeNull();
  });
});

describe('currentPhase', () => {
  it('maps days to the right phase', () => {
    expect(currentPhase(phases, 1)?.index).toBe(0);
    expect(currentPhase(phases, 30)?.index).toBe(0);
    expect(currentPhase(phases, 31)?.index).toBe(1);
    expect(currentPhase(phases, 90)?.index).toBe(2);
  });
  it('returns the last phase when past the end', () => {
    expect(currentPhase(phases, 120)?.index).toBe(2);
  });
  it('is null with no day', () => {
    expect(currentPhase(phases, null)).toBeNull();
  });
});

describe('percentLoss', () => {
  it('computes the rules example (80 -> 72 = 10%)', () => {
    expect(percentLoss(80, 72)).toBe(10);
  });
  it('rounds to 2 dp (70 -> 62 = 11.43%)', () => {
    expect(percentLoss(70, 62)).toBe(11.43);
  });
  it('is null on missing/invalid input', () => {
    expect(percentLoss(null, 70)).toBeNull();
    expect(percentLoss(0, 0)).toBeNull();
  });
});

describe('participantView', () => {
  const base = { startAt: null, initialWeightKg: null, finalWeightKg: null, percentLoss: null, dropReason: null };
  const view = (status: ParticipantStatus, extra: Partial<typeof base> & { startAt?: Date | null } = {}, now?: Date) =>
    participantView({ ...base, ...extra, status }, timing, now);

  it('pending initial review', () => {
    const v = view('PENDING_INITIAL_REVIEW');
    expect(v.group).toBe('pending');
    expect(v.displayStatus).toBe('Menunggu Verifikasi Bukti Awal');
  });

  it('running shows the current phase', () => {
    const start = D('2026-06-06T10:00:00+07:00');
    const v = view('RUNNING', { startAt: start }, D('2026-06-10T10:00:00+07:00'));
    expect(v.group).toBe('active');
    expect(v.displayStatus).toBe('Challenge Berjalan — Fase 1');
    expect(v.dayOfChallenge).toBe(5);
  });

  it('running past day 90 awaits final proof; overdue after the window', () => {
    const start = D('2026-01-01T10:00:00+07:00');
    const day95 = D('2026-01-01T10:00:00+07:00'); day95.setDate(day95.getDate() + 94); // day 95
    const v = view('RUNNING', { startAt: start }, day95);
    expect(v.displayStatus).toBe('Menunggu Bukti Akhir');
    expect(v.finalOverdue).toBe(false);
    const day110 = D('2026-01-01T10:00:00+07:00'); day110.setDate(day110.getDate() + 109);
    expect(view('RUNNING', { startAt: start }, day110).finalOverdue).toBe(true);
  });

  it('completed shows %loss', () => {
    const v = view('COMPLETED', { initialWeightKg: 80, finalWeightKg: 72, percentLoss: 10 });
    expect(v.group).toBe('completed');
    expect(v.displayStatus).toBe('Selesai');
    expect(v.percentLoss).toBe(10);
  });

  it('dropped maps the reason label', () => {
    const v = view('DROPPED', { dropReason: 'disqualified' });
    expect(v.group).toBe('dropped');
    expect(v.displayStatus).toBe('Diskualifikasi');
  });

  it('awaiting initial (auto-created on PAID) shows Menunggu Bukti Awal / pending', () => {
    const v = view('AWAITING_INITIAL');
    expect(v.group).toBe('pending');
    expect(v.displayStatus).toBe('Menunggu Bukti Awal');
  });
});

describe('computeDueReminders (D12 schedule)', () => {
  const timing = { startWindowDays: cfg.startWindowDays, durationDays: cfg.durationDays, finalProofWindowDays: cfg.finalProofWindowDays, phases };
  const base = D('2026-01-01T10:00:00+07:00');
  const at = (days: number) => new Date(base.getTime() + days * 86_400_000);

  it('AWAITING_INITIAL: after_purchase on day 0, then h7/h13/h14', () => {
    const p = { status: 'AWAITING_INITIAL' as ParticipantStatus, purchaseAt: base, startAt: null, finalSubmittedAt: null };
    expect(computeDueReminders(p, timing, new Set(), at(0)).send).toEqual(['after_purchase']);
    expect(computeDueReminders(p, timing, new Set(), at(7)).send).toEqual(['after_purchase', 'h7']);
    expect(computeDueReminders(p, timing, new Set(), at(14)).send).toEqual(['after_purchase', 'h7', 'h13', 'h14']);
  });

  it('AWAITING_INITIAL: skips already-sent keys (idempotent)', () => {
    const p = { status: 'AWAITING_INITIAL' as ParticipantStatus, purchaseAt: base, startAt: null, finalSubmittedAt: null };
    expect(computeDueReminders(p, timing, new Set(['after_purchase', 'h7']), at(7)).send).toEqual([]);
  });

  it('AWAITING_INITIAL: day 15 sends h15 and eliminates_initial', () => {
    const p = { status: 'AWAITING_INITIAL' as ParticipantStatus, purchaseAt: base, startAt: null, finalSubmittedAt: null };
    const r = computeDueReminders(p, timing, new Set(['after_purchase', 'h7', 'h13', 'h14']), at(15));
    expect(r.send).toEqual(['h15']);
    expect(r.drop).toBe('eliminated_initial');
  });

  it('RUNNING: phase markers at day 1/30/60/90', () => {
    const p = { status: 'RUNNING' as ParticipantStatus, purchaseAt: base, startAt: base, finalSubmittedAt: null };
    expect(computeDueReminders(p, timing, new Set(), at(0)).send).toEqual(['day1']); // day 1
    expect(computeDueReminders(p, timing, new Set(['day1']), at(29)).send).toEqual(['day30']); // day 30
    expect(computeDueReminders(p, timing, new Set(['day1', 'day30', 'day60']), at(89)).send).toEqual(['day90']); // day 90
  });

  it('RUNNING: final-proof reminders only while final not submitted; day 105 eliminates', () => {
    const sent = new Set(['day1', 'day30', 'day60', 'day90', 'day97', 'day103', 'day104']);
    const p = { status: 'RUNNING' as ParticipantStatus, purchaseAt: base, startAt: base, finalSubmittedAt: null };
    const r = computeDueReminders(p, timing, sent, at(104)); // day 105
    expect(r.send).toEqual(['day105']);
    expect(r.drop).toBe('eliminated_final');

    const submitted = { ...p, finalSubmittedAt: at(95) };
    expect(computeDueReminders(submitted, timing, new Set(['day1', 'day30', 'day60', 'day90']), at(104)).send).toEqual([]);
    expect(computeDueReminders(submitted, timing, new Set(['day1', 'day30', 'day60', 'day90']), at(104)).drop).toBeNull();
  });
});

describe('renderTemplate', () => {
  it('substitutes {{contact}} and falls back to "-"', () => {
    expect(renderTemplate('hub : {{contact}}', '0812')).toBe('hub : 0812');
    expect(renderTemplate('hub : {{contact}}', '')).toBe('hub : -');
  });
});
