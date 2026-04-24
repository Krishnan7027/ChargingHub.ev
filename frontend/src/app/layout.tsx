import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/context/AuthContext';
import { CountryProvider } from '@/context/CountryContext';
import { ThemeProvider } from '@/context/ThemeContext';
import QueryProvider from '@/context/QueryProvider';
import GlassBackground from '@/components/ui/GlassBackground';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Toaster } from 'react-hot-toast';
import DisableNumberScroll from '@/components/ui/DisableNumberScroll';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'EV Charge Hub - Find & Reserve Charging Stations',
  description: 'Discover nearby EV charging stations, view slot availability, and reserve charging slots in real-time.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#178750',
};

// Inline script to prevent flash of wrong theme (FOUC)
// This is a static string constant — safe for dangerouslySetInnerHTML (no user input)
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-WP084YB3W3"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-WP084YB3W3');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <CountryProvider>
            <AuthProvider>
              <GlassBackground />
              <DisableNumberScroll />
              {children}
              <ThemeToggle />
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 4000,
                  style: {
                    borderRadius: '1rem',
                    padding: '14px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    background: 'var(--glass-bg-heavy)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--glass-shadow-heavy)',
                  },
                  success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#dc2626', secondary: '#fff' }, duration: 5000 },
                }}
              />
            </AuthProvider>
            </CountryProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
