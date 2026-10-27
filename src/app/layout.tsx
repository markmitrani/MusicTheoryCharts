import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.scss';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Music Theory Playground',
  description:
    'An infinite canvas for arranging scales, chords, and musical ideas – composition, improvisation, or pure learning.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-surfaces="flat"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable}`}
    >
      <head>
        {/* Apply saved theme, surfaces and colours before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement.dataset,t=localStorage.getItem('mtp-theme'),s=localStorage.getItem('mtp-surfaces');if(t)d.theme=t;if(s)d.surfaces=s;if(localStorage.getItem('mtp-colors-on')==='1'){var c=JSON.parse(localStorage.getItem('mtp-colors')||'{}')[d.theme||'dark']||{};for(var k in c)document.documentElement.style.setProperty(k,c[k]);}}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
