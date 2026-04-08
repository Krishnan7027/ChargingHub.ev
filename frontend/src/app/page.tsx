'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import { useEffect, useState } from 'react';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K+`;
  return `${n}`;
}

const steps = [
  {
    number: '01',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    gradient: 'from-blue-500 to-cyan-500',
    title: 'Find a Station',
    desc: 'Use GPS or search by location. Filter by charging type, speed, and amenities to find the perfect station.',
  },
  {
    number: '02',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-primary-500 to-primary-700',
    title: 'Reserve Your Slot',
    desc: 'See real-time availability and book your preferred time slot. Never arrive at a full station again.',
  },
  {
    number: '03',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    gradient: 'from-amber-500 to-orange-500',
    title: 'Start Charging',
    desc: 'Plug in and track your session in real-time. Smart predictions estimate completion and cost as you charge.',
  },
];

const roles = [
  {
    role: 'EV Owners',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    items: ['Find nearby stations', 'Real-time availability', 'Reserve & track charging', 'Smart wait predictions'],
  },
  {
    role: 'Station Managers',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    items: ['Register stations', 'Manage slots & pricing', 'Track charging sessions', 'View reservations'],
  },
  {
    role: 'Platform Admins',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    items: ['Approve stations', 'Manage all users', 'Monitor platform activity', 'View analytics'],
  },
];

const footerLinks = {
  Product: [
    { label: 'Map', href: '/map' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Pricing', href: '#' },
    { label: 'API', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Support: [
    { label: 'Help Center', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Community', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

export default function HomePage() {
  const [stats, setStats] = useState({ stations: 0, users: 0, kwhDelivered: 0, uptime: 99.9 });

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/public/stats`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const statCards = [
    {
      value: formatNumber(stats.stations),
      label: 'Stations',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      value: formatNumber(stats.users),
      label: 'Active Users',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      value: formatNumber(stats.kwhDelivered),
      label: 'kWh Delivered',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      value: `${stats.uptime}%`,
      label: 'Uptime',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Navbar />
      <main>
        {/* ═══ Hero Section ═══════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 dark:from-primary-950 dark:via-primary-900 dark:to-primary-800 text-white">
          {/* Decorative dot grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" aria-hidden="true">
            <defs>
              <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>

          {/* Gradient orbs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-300/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 pb-32 md:pb-40">
            <div className="max-w-3xl">
              <h1 className="animate-in text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Find & Reserve EV Charging Stations
              </h1>
              <p className="animate-in delay-75 mt-6 text-lg md:text-xl text-primary-100 dark:text-primary-200 leading-relaxed max-w-2xl">
                Discover nearby charging stations, check real-time slot availability,
                and reserve your spot before you arrive. Smart predictions tell you
                when the next slot opens up.
              </p>
              <div className="animate-in delay-150 mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/map"
                  className="inline-flex items-center justify-center px-9 py-4 bg-white dark:bg-white/95 text-primary-700 font-semibold rounded-xl hover:bg-primary-50 dark:hover:bg-white transition-all text-lg shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/25"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Find Stations Nearby
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-9 py-4 border-2 border-white/80 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-lg shadow-lg shadow-black/10"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
        </section>

        {/* ═══ Stats Cards — 2x2 grid, glass style ════════════════ */}
        <section className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {statCards.map((stat, i) => (
              <div
                key={i}
                className="animate-in glass glass-refraction rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.03]"
                style={{ animationDelay: `${i * 75 + 150}ms` }}
              >
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  {stat.icon}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-theme-primary tabular-nums">
                  {stat.value}
                </div>
                <div className="text-sm text-theme-muted mt-1 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ How It Works — Step-based layout ═══════════════════ */}
        <section className="py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="animate-in text-3xl md:text-4xl font-bold text-theme-primary">
                How It Works
              </h2>
              <p className="animate-in delay-75 mt-4 text-theme-secondary text-lg max-w-2xl mx-auto">
                Get started in three simple steps and never worry about finding a charger again.
              </p>
            </div>

            {/* Steps — horizontal on desktop, vertical on mobile */}
            <div className="relative">
              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-[4.5rem] left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-blue-500/30 via-primary-500/30 to-amber-500/30" />

              <div className="grid md:grid-cols-3 gap-12 md:gap-8">
                {steps.map((step, i) => (
                  <div key={i} className="relative">
                    {/* Mobile connector line */}
                    {i < steps.length - 1 && (
                      <div className="md:hidden absolute left-[2.25rem] top-[5.5rem] bottom-[-2rem] w-[2px] bg-gradient-to-b from-primary-500/20 to-primary-500/5" />
                    )}

                    <div className="card glass-refraction text-center p-8 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
                      {/* Step number badge */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-primary-600 text-white shadow-md">
                        STEP {step.number}
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-16 h-16 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mx-auto mt-4 mb-6 shadow-lg text-white`}
                      >
                        {step.icon}
                      </div>

                      <h3 className="text-xl font-semibold mb-3 text-theme-primary">{step.title}</h3>
                      <p className="text-theme-secondary leading-relaxed text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Roles Section ══════════════════════════════════════ */}
        <section className="bg-theme-secondary py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="animate-in text-3xl md:text-4xl font-bold text-theme-primary">
                For Everyone in the EV Ecosystem
              </h2>
              <p className="animate-in delay-75 mt-4 text-theme-secondary text-lg max-w-2xl mx-auto">
                Whether you drive an EV, manage a station, or oversee the platform, we have you covered.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {roles.map((card, i) => (
                <div
                  key={i}
                  className="group relative glass glass-refraction rounded-2xl p-8 transition-all duration-300 hover:shadow-lg hover:border-primary-500/30 hover:bg-primary-500/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300">
                      {card.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-theme-primary">{card.role}</h3>
                  </div>
                  <ul className="space-y-4">
                    {card.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-3 text-theme-secondary">
                        <svg className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA Section ════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-gradient-to-r from-primary-700 to-primary-900 dark:from-primary-800 dark:to-primary-950 py-20 md:py-28">
          <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden="true">
            <defs>
              <pattern id="cta-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0v40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cta-grid)" />
          </svg>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="animate-in text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to charge smarter?
            </h2>
            <p className="animate-in delay-75 text-primary-200 text-lg mb-10 max-w-2xl mx-auto">
              Join thousands of EV owners who never worry about finding a charger again.
            </p>
            <div className="animate-in delay-150 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-9 py-4 bg-white dark:bg-white/95 text-primary-700 font-semibold rounded-xl hover:bg-primary-50 dark:hover:bg-white transition-all text-lg shadow-lg"
              >
                Create Free Account
              </Link>
              <Link
                href="/map"
                className="inline-flex items-center justify-center px-9 py-4 border-2 border-white/80 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-lg"
              >
                Explore the Map
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ Footer ═════════════════════════════════════════════ */}
        <footer className="bg-[var(--bg-tertiary)] text-theme-muted border-t border-[var(--border-default)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              {/* Brand column */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-lg font-bold text-theme-primary">EV Charge Hub</span>
                </div>
                <p className="text-sm leading-relaxed">
                  EV Charging Station Discovery & Reservation Platform
                </p>
              </div>

              {/* Link columns */}
              {Object.entries(footerLinks).map(([heading, links]) => (
                <div key={heading}>
                  <h4 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-4">
                    {heading}
                  </h4>
                  <ul className="space-y-3">
                    {links.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="text-sm hover:text-theme-primary transition-colors">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom bar */}
            <div className="mt-12 pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm">
                &copy; {new Date().getFullYear()} EV Charge Hub. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a href="#" className="hover:text-theme-primary transition-colors" aria-label="GitHub">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="hover:text-theme-primary transition-colors" aria-label="Twitter">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
