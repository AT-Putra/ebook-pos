import { NextRequest, NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { processDueChallengeReminders } from '@/lib/challenge-reminders';

// Hourly cron — sends due challenge WhatsApp reminders + auto-eliminates (PRD §21.8).
// Auth = isCron (CRON_SECRET bearer), same as /api/cron/process-deliveries.
export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const result = await processDueChallengeReminders();
  return NextResponse.json(result);
}
