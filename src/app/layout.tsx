import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'E-book Store',
  description: 'Buy and receive your e-book instantly via WhatsApp.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
