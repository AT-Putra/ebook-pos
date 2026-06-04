import { Suspense } from 'react';
import { ThankYouContent } from './content';

export default function ThankYouPage() {
  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <Suspense fallback={<p>Memuat...</p>}>
        <ThankYouContent />
      </Suspense>
    </main>
  );
}
