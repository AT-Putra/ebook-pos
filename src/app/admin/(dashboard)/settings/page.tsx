import { OriginManager } from '@/components/admin/OriginManager';
import { RateLimitSettings } from '@/components/admin/RateLimitSettings';

export default function SettingsPage() {
  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Pengaturan</h1>
      <OriginManager />
      <RateLimitSettings />
    </div>
  );
}
