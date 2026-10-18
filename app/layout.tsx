import type { Metadata } from 'next';
import { Inter, Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Navbar } from '@/components/nav/Navbar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-serif-sc',
  display: 'swap',
});

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-sc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bamboo 竹 — Learn Chinese through Reading',
  description: 'A local-first reading and SRS app for intermediate to advanced Chinese learners.',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
};

import { Suspense } from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('bamboo-theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const theme = (saved === 'dark' || (!saved && prefersDark)) ? 'dark' : (saved === 'light' ? 'light' : (prefersDark ? 'dark' : 'light'));
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${notoSerifSC.variable} ${notoSansSC.variable} antialiased min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]`}
      >
        <ThemeProvider>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <main className="flex-1 pb-16 sm:pb-0">
            <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--ink-muted)]">Loading...</div>}>
              {children}
            </Suspense>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
