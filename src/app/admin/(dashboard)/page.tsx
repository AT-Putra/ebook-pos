import { LeadsReport } from '@/components/admin/LeadsReport';
import { getReport } from '@/lib/report';

function wibDateStr(offsetDays: number): string {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  const from = wibDateStr(-14);
  const to = wibDateStr(-1);
  const data = await getReport(from, to);

  return <LeadsReport initial={data} />;
}
