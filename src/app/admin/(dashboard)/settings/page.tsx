import { OriginManager } from '@/components/admin/OriginManager';

export default function SettingsPage() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 1rem' }}>Pengaturan</h1>
      <OriginManager />
    </div>
  );
}
