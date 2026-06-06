import { OriginManager } from '@/components/admin/OriginManager';
import { RateLimitSettings } from '@/components/admin/RateLimitSettings';
import { CardStack, PageHeader } from '@/components/admin/Card';

export default function SettingsPage() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi domain checkout dan rate limit." />
      <CardStack>
        <OriginManager />
        <RateLimitSettings />
      </CardStack>
    </div>
  );
}
