import { Toaster } from '@/components/ui/toaster';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { Noto_Sans } from 'next/font/google';

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-noto-sans',
  display: 'swap'
});

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'BSV Faucet',
  description: 'Request testnet BSV tokens.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={notoSans.variable}>
        <head>
          <link rel="preconnect" href="https://api.fontshare.com" />
          <link
            rel="stylesheet"
            href="https://api.fontshare.com/v2/css?f[]=chillax@400,500,600&display=swap"
          />
        </head>
        <body className="flex min-h-screen w-full flex-col font-sans">
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
      <Analytics />
    </ClerkProvider>
  );
}
