import type { ReactNode } from 'react';
import './globals.css';
export const metadata = { title: 'Lingvessa Admin', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="uk"><body>{children}</body></html>;
}
