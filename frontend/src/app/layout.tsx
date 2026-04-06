import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { CountryProvider } from '@/context/CountryContext';
import QueryProvider from '@/context/QueryProvider';
import { Toaster } from 'react-hot-toast';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <QueryProvider>
          <CountryProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '1rem',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                },
                success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
                error: { iconTheme: { primary: '#dc2626', secondary: '#fff' }, duration: 5000 },
              }}
            />
          </AuthProvider>
          </CountryProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
