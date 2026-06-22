import { OriginManager } from '@/components/admin/OriginManager';
import { RateLimitSettings } from '@/components/admin/RateLimitSettings';
import { MessagingEngineSettings } from '@/components/admin/MessagingEngineSettings';
import { UserManager } from '@/components/admin/UserManager';
import { CardStack, PageHeader } from '@/components/admin/Card';

export default function SettingsPage() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi domain checkout, rate limit, engine WhatsApp, dan akun admin." />
      <CardStack>
        <OriginManager />
        <RateLimitSettings />
        <MessagingEngineSettings />
        <UserManager />
      </CardStack>
    </div>
  );
}
