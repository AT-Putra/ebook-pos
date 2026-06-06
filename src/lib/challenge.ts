// Pure challenge logic (no DB) — unit-testable. See PRD §21 and docs/challenge-rules.md.
import type { ParticipantStatus } from '@prisma/client';

export type ChallengePhase = { name: string; focus: string; startDay: number; endDay: number };
export type WinnerTier = { label: string; prize: string; count: number };
export type MessageTemplates = Record<string, string>;

export type ChallengeConfig = {
  startWindowDays: number;
  durationDays: number;
  finalProofWindowDays: number;
  videoMaxSeconds: number;
  videoMaxSizeMb: number;
  videoFormat: string;
  phases: ChallengePhase[];
  rewardsText: string;
  winnerTiers: WinnerTier[];
  contactInfo: string;
  messageTemplates: MessageTemplates;
};

const VIDEO_SPEC =
  'video maximal 30 detik format mp4 maximal 10 Mb yang memperlihatkan wajah bersama angka timbangan ' +
  'awal yang terlihat jelas (harus menggunakan timbangan digital), video bukan potongan melainkan full ' +
  'video yang ada stempel tanggal dan waktu, video bukan hasil editan atau AI. User bisa mendownload ' +
  'aplikasi "Timestamp camera" di google play atau Appstore untuk membuat video dengan stempel tanggal ' +
  'dan waktu atau bisa menggunakan aplikasi serupa.';

/** Default challenge config, seeded from docs/challenge-rules.md. `{{contact}}` is replaced
 *  with the challenge's contactInfo by the (deferred) D12 reminder automation. */
export function defaultChallengeConfig(): ChallengeConfig {
  return {
    startWindowDays: 14,
    durationDays: 90,
    finalProofWindowDays: 14,
    videoMaxSeconds: 30,
    videoMaxSizeMb: 10,
    videoFormat: 'mp4',
    phases: [
      { name: 'Reset Pola Hidup', startDay: 1, endDay: 30, focus: 'Membiasakan jam makan, stop minuman manis, olahraga ringan, target langkah, dan checklist harian.' },
      { name: 'Bakar Lemak & Bangun Kekuatan', startDay: 31, endDay: 60, focus: 'Meningkatkan latihan beban, aerobik, target langkah, protein, dan kontrol makan malam.' },
      { name: 'Bentuk Tubuh & Pertahankan Hasil', startDay: 61, endDay: 90, focus: 'Menjaga konsistensi, memperkuat tubuh, mengurangi cheating, dan menyiapkan pola maintenance.' },
    ],
    rewardsText:
      'iPhone 17 Pro Max 128 GB untuk 1 orang pemenang utama. Saldo e-wallet sebesar 5 juta rupiah untuk 10 orang. ' +
      'Reward diberikan kepada peserta dengan progres terbaik berdasarkan persentase penurunan berat badan terbesar. ' +
      'Program ini bukan undian.',
    winnerTiers: [
      { label: 'Pemenang Utama', prize: 'iPhone 17 Pro Max 128 GB', count: 1 },
      { label: 'Runner-up', prize: 'Saldo e-wallet Rp 5.000.000', count: 10 },
    ],
    contactInfo: '',
    messageTemplates: {
      after_purchase: `Selamat bergabung di Tantangan Turun 10 Kg dalam 90 Hari. Untuk memulai challenge, kirim ${VIDEO_SPEC} Kamu punya waktu maksimal 14 hari untuk memulai challenge. Untuk info lebih lanjut hub : {{contact}}`,
      h7: `Reminder: kamu belum memulai challenge. Untuk memulai challenge, segera kirim ${VIDEO_SPEC} Kamu punya waktu 7 hari untuk memulai challenge. Untuk info lebih lanjut hub : {{contact}}`,
      h13: `Reminder: Besok adalah batas terakhir untuk memulai challenge. Segera kirim ${VIDEO_SPEC} Jika belum mengirim video bukti awal sampai dengan besok kamu dianggap gugur dari keikutsertaan program reward. Untuk info lebih lanjut hub : {{contact}}`,
      h14: `Reminder terakhir: Hari ini adalah batas terakhir untuk memulai challenge. Segera kirim ${VIDEO_SPEC} Jika belum mengirim video bukti awal sampai dengan hari ini kamu dianggap gugur dari keikutsertaan program reward. Untuk info lebih lanjut hub : {{contact}}`,
      h15: 'Mohon maaf, batas waktu memulai challenge sudah berakhir. Karena bukti awal tidak dikirim dalam waktu 14 hari setelah pembelian, kamu dianggap gugur dari keikutsertaan program reward.',
      day1: 'Bukti awal berhasil diterima. Challenge kamu resmi dimulai hari ini. Satu halaman setiap hari. Ikuti jadwalnya, centang checklist-nya, lihat progresnya. Kami akan mengingatkan kamu kembali di hari ke-30, hari ke-60, dan hari ke-90.',
      day30: 'Selamat, kamu sudah menyelesaikan 30 hari pertama. Fase 1 selesai: Reset Pola Hidup. Sekarang kamu masuk ke Fase 2: Bakar Lemak & Bangun Kekuatan. Lanjutkan ke halaman hari ke-31 dan tetap ikuti jadwalnya.',
      day60: 'Mantap, kamu sudah sampai hari ke-60. Fase 2 selesai: Bakar Lemak & Bangun Kekuatan. Sekarang kamu masuk ke Fase 3: Bentuk Tubuh & Pertahankan Hasil. Tinggal 30 hari lagi menuju akhir challenge.',
      day90: `Selamat, kamu sudah sampai di hari ke-90. Sekarang waktunya mengirim bukti akhir challenge. Segera kirim bukti akhir berupa ${VIDEO_SPEC} Batas pengiriman bukti akhir maksimal 14 hari dari hari ini.`,
      day97: `Reminder: kamu belum mengirim bukti akhir challenge. Segera kirim bukti akhir berupa ${VIDEO_SPEC} Batas akhir pengiriman tersisa 7 hari. Untuk info lebih lanjut hub : {{contact}}`,
      day103: `Reminder terakhir. Besok adalah batas terakhir pengiriman bukti akhir challenge. Segera kirim bukti akhir berupa ${VIDEO_SPEC} Jika bukti akhir tidak dikirim sampai batas waktu, peserta dianggap gugur dari penilaian reward. Untuk info lebih lanjut hub : {{contact}}`,
      day104: `Reminder terakhir. Hari ini adalah batas terakhir pengiriman bukti akhir challenge. Segera kirim bukti akhir berupa ${VIDEO_SPEC} Jika bukti akhir tidak dikirim sampai batas waktu, peserta dianggap gugur dari penilaian reward. Untuk info lebih lanjut hub : {{contact}}`,
      day105: 'Mohon maaf, batas pengiriman bukti akhir sudah berakhir. Karena bukti akhir tidak dikirim dalam waktu 14 hari setelah hari ke-90, peserta dianggap gugur dari keikutsertaan program reward.',
      final_received: 'Bukti akhir berhasil diterima. Selamat kamu sudah menyelesaikan challenge sampai tahap akhir. Terima kasih sudah berjuang dan konsisten mengikuti prosesnya. Selanjutnya, kamu tinggal menunggu informasi hasil challenge dan pengumuman pemenang reward melalui WhatsApp ini.',
    },
  };
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** WIB midnight (as a ms timestamp) for the day `d` falls on. */
function wibMidnightMs(d: Date): number {
  const shifted = d.getTime() + WIB_OFFSET_MS;
  return Math.floor(shifted / 86_400_000) * 86_400_000;
}

/** 1-based challenge day (day 1 = the WIB calendar day of startAt). null if not started. */
export function dayOfChallenge(startAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!startAt) return null;
  const days = (wibMidnightMs(now) - wibMidnightMs(startAt)) / 86_400_000;
  return Math.floor(days) + 1;
}

/** Whole WIB calendar days elapsed since `from` (0 on the same day). */
export function daysSince(from: Date, now: Date = new Date()): number {
  return Math.floor((wibMidnightMs(now) - wibMidnightMs(from)) / 86_400_000);
}

/** The phase whose [startDay,endDay] contains `day`, or the last phase if `day` is past the end. */
export function currentPhase(phases: ChallengePhase[], day: number | null): { phase: ChallengePhase; index: number } | null {
  if (day == null || phases.length === 0) return null;
  for (let i = 0; i < phases.length; i++) {
    if (day >= phases[i].startDay && day <= phases[i].endDay) return { phase: phases[i], index: i };
  }
  if (day > phases[phases.length - 1].endDay) return { phase: phases[phases.length - 1], index: phases.length - 1 };
  return { phase: phases[0], index: 0 };
}

/** (initial − final) / initial × 100, rounded to 2 dp. null if inputs missing/invalid. */
export function percentLoss(initialKg: number | null | undefined, finalKg: number | null | undefined): number | null {
  if (initialKg == null || finalKg == null || initialKg <= 0) return null;
  return Math.round(((initialKg - finalKg) / initialKg) * 100 * 100) / 100;
}

export type ParticipantGroup = 'pending' | 'active' | 'completed' | 'dropped';

export type ParticipantLike = {
  status: ParticipantStatus;
  startAt: Date | null;
  initialWeightKg: number | null;
  finalWeightKg: number | null;
  percentLoss: number | null;
  dropReason: string | null;
};
export type ChallengeTimingLike = { durationDays: number; finalProofWindowDays: number; phases: ChallengePhase[] };

export type ParticipantView = {
  dayOfChallenge: number | null;
  phaseIndex: number | null;
  phaseName: string | null;
  displayStatus: string;
  group: ParticipantGroup;
  percentLoss: number | null;
  finalOverdue: boolean;
};

const DROP_LABEL: Record<string, string> = {
  eliminated_initial: 'Gugur Awal',
  eliminated_final: 'Gugur Akhir',
  disqualified: 'Diskualifikasi',
};

/** Derives the dashboard view (day/phase/status label/group) for a participant. */
export function participantView(p: ParticipantLike, c: ChallengeTimingLike, now: Date = new Date()): ParticipantView {
  const day = dayOfChallenge(p.startAt, now);
  const phase = currentPhase(c.phases, day);
  const phaseIndex = phase?.index ?? null;
  const phaseName = phase?.phase.name ?? null;

  let group: ParticipantGroup;
  let displayStatus: string;

  switch (p.status) {
    case 'AWAITING_INITIAL':
      group = 'pending';
      displayStatus = 'Menunggu Bukti Awal';
      break;
    case 'PENDING_INITIAL_REVIEW':
      group = 'pending';
      displayStatus = 'Menunggu Verifikasi Bukti Awal';
      break;
    case 'RUNNING':
      group = 'active';
      if (day != null && day > c.durationDays) displayStatus = 'Menunggu Bukti Akhir';
      else displayStatus = `Challenge Berjalan — Fase ${(phaseIndex ?? 0) + 1}`;
      break;
    case 'PENDING_FINAL_REVIEW':
      group = 'active';
      displayStatus = 'Menunggu Verifikasi Bukti Akhir';
      break;
    case 'COMPLETED':
      group = 'completed';
      displayStatus = 'Selesai';
      break;
    case 'DROPPED':
    default:
      group = 'dropped';
      displayStatus = (p.dropReason && DROP_LABEL[p.dropReason]) || 'Gugur';
      break;
  }

  const finalOverdue =
    p.status === 'RUNNING' && day != null && day > c.durationDays + c.finalProofWindowDays;

  return {
    dayOfChallenge: day,
    phaseIndex,
    phaseName,
    displayStatus,
    group,
    percentLoss: p.percentLoss ?? percentLoss(p.initialWeightKg, p.finalWeightKg),
    finalOverdue,
  };
}

// ── D12: reminder scheduling (pure, tested) ─────────────────────────────────

export type ReminderInput = {
  status: ParticipantStatus;
  purchaseAt: Date;
  startAt: Date | null;
  finalSubmittedAt: Date | null;
};
export type ReminderTiming = {
  startWindowDays: number;
  durationDays: number;
  finalProofWindowDays: number;
  phases: ChallengePhase[];
};
export type DropReason = 'eliminated_initial' | 'eliminated_final';
export type DueReminders = { send: string[]; drop: DropReason | null };

/**
 * Given a participant's timeline + which reminder keys were already sent, returns the keys due now
 * and any auto-elimination. Thresholds use `>=` so a missed cron hour still catches up; each key is
 * gated by `sentKeys` for idempotency. See docs/challenge-rules.md §7 and PRD §21.8.
 */
export function computeDueReminders(
  p: ReminderInput,
  t: ReminderTiming,
  sentKeys: Set<string>,
  now: Date = new Date(),
): DueReminders {
  const send: string[] = [];
  let drop: DropReason | null = null;
  const add = (k: string) => { if (!sentKeys.has(k)) send.push(k); };

  if (p.status === 'AWAITING_INITIAL') {
    const d = daysSince(p.purchaseAt, now); // 0 on purchase day
    if (d >= 0) add('after_purchase');
    if (d >= 7) add('h7');
    if (d >= 13) add('h13');
    if (d >= 14) add('h14');
    if (d >= t.startWindowDays + 1) { add('h15'); drop = 'eliminated_initial'; }
  } else if (p.status === 'RUNNING' && p.startAt) {
    const day = dayOfChallenge(p.startAt, now) ?? 0; // 1-based
    const phase1End = t.phases[0]?.endDay ?? 30;
    const phase2End = t.phases[1]?.endDay ?? 60;
    if (day >= 1) add('day1');
    if (day >= phase1End) add('day30');
    if (day >= phase2End) add('day60');
    if (day >= t.durationDays) add('day90');
    if (!p.finalSubmittedAt) {
      if (day >= t.durationDays + 7) add('day97');
      if (day >= t.durationDays + 13) add('day103');
      if (day >= t.durationDays + 14) add('day104');
      if (day >= t.durationDays + t.finalProofWindowDays + 1) { add('day105'); drop = 'eliminated_final'; }
    }
  }

  return { send, drop };
}

/** Substitutes `{{contact}}` in a template with the challenge contact (falls back to "-"). */
export function renderTemplate(tpl: string, contact: string | null | undefined): string {
  return tpl.replaceAll('{{contact}}', contact || '-');
}
