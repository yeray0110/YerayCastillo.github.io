import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'My ingredient list',
  description: 'A reusable ingredient list that creates your shopping list automatically.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
