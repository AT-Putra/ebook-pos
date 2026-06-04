import { NextRequest, NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { processDueDeliveries } from '@/lib/delivery';

export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const result = await processDueDeliveries();
  return NextResponse.json(result);
}
