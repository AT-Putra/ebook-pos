import { DownloadForm } from './DownloadForm';

// Public e-book download page (D16, §25). The buyer opens the protected link from WhatsApp and
// verifies their registered WhatsApp number here to download the PDF. No login.
export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DownloadForm token={token} />;
}
