import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'TRIBE UX Analyzer',
  description: 'Neural-driven UX analysis using Meta\'s TRIBE v2 brain encoding model',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><ellipse cx='16' cy='16' rx='12' ry='10' fill='none' stroke='%2339ff85' stroke-width='2'/><circle cx='16' cy='16' r='3' fill='%2339ff85'/></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
