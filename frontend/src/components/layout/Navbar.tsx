'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { getCountryList } from '@/lib/countries';
import { canAccessRoutePlanner, canAccessSmartFeatures, getSmartFeatures } from '@/lib/roles';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useState, useRef, useEffect } from 'react';

function DropdownMenu({ label, items, onClose }: {
  label: string;
  items: { href: string; label: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-48 glass-heavy rounded-xl py-1 z-50">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-theme-muted">{label}</p>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block px-3 py-2 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors rounded-lg mx-1"
          onClick={onClose}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative text-sm font-medium transition-colors ${
        isActive
          ? 'text-primary-500 font-semibold'
          : 'text-theme-secondary hover:text-primary-500'
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-[1.19rem] left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
      )}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'text-primary-500 font-semibold bg-primary-500/10'
          : 'text-theme-primary hover:bg-primary-500/5'
      }`}
    >
      {children}
    </Link>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 bg-primary-500/15 text-primary-500 rounded-full flex items-center justify-center text-sm font-semibold">
      {name.charAt(0)}
    </div>
  );
}

function CountrySelector() {
  const { country, setCountryCode } = useCountry();
  const countries = getCountryList();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:text-primary-500 transition-colors px-2 py-1 rounded-lg hover:bg-primary-500/5"
      >
        <span className="text-base">{country.flag}</span>
        <span className="hidden sm:inline">{country.code}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 glass-heavy rounded-xl py-1 z-50">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-theme-muted">Region</p>
          {countries.map((c) => (
            <button
              key={c.code}
              onClick={() => { setCountryCode(c.code); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-primary-500/10 transition-colors rounded-lg mx-1 ${
                c.code === country.code ? 'text-primary-500 font-semibold bg-primary-500/10' : 'text-theme-primary'
              }`}
            >
              <span className="text-base">{c.flag}</span>
              {c.name}
              <span className="text-theme-muted ml-auto text-xs">{c.currencySymbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [smartMenuOpen, setSmartMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const dashboardPath = user
    ? user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/customer'
    : '/login';

  const smartFeatures = getSmartFeatures(user?.role);

  const adminFeatures = [
    { href: '/admin/analytics', label: 'Analytics' },
    { href: '/admin/energy', label: 'Energy Management' },
    { href: '/admin/smart-city', label: 'Smart City' },
  ];

  return (
    <nav className="glass-heavy border-b border-glass sticky top-0 z-[1100]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/25">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-theme-primary">EV Charge Hub</span>
            </Link>

            <div className="hidden md:flex ml-10 gap-6 items-center">
              <NavLink href="/map">
                Find Stations
              </NavLink>
              {canAccessRoutePlanner(user?.role) && (
                <NavLink href="/route-planner">
                  Route Planner
                </NavLink>
              )}
              {user && (
                <NavLink href={dashboardPath}>
                  Dashboard
                </NavLink>
              )}
              {user && (
                <NavLink href="/reservations">
                  Reservations
                </NavLink>
              )}
              {/* Smart Features dropdown — customer only */}
              {user && canAccessSmartFeatures(user.role) && (
                <div className="relative">
                  <button
                    onClick={() => { setSmartMenuOpen(!smartMenuOpen); setAdminMenuOpen(false); }}
                    className="flex items-center gap-1 text-theme-secondary hover:text-primary-500 transition-colors text-sm font-medium"
                  >
                    Smart Features
                    <svg className={`w-4 h-4 transition-transform ${smartMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {smartMenuOpen && (
                    <DropdownMenu label="Features" items={smartFeatures} onClose={() => setSmartMenuOpen(false)} />
                  )}
                </div>
              )}
              {/* Admin dropdown */}
              {user?.role === 'admin' && (
                <div className="relative">
                  <button
                    onClick={() => { setAdminMenuOpen(!adminMenuOpen); setSmartMenuOpen(false); }}
                    className="flex items-center gap-1 text-theme-secondary hover:text-primary-500 transition-colors text-sm font-medium"
                  >
                    Admin
                    <svg className={`w-4 h-4 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {adminMenuOpen && (
                    <DropdownMenu label="Admin" items={adminFeatures} onClose={() => setAdminMenuOpen(false)} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <CountrySelector />
            {user ? (
              <>
                <UserAvatar name={user.full_name} />
                <span className="text-sm text-theme-primary font-medium">{user.full_name}</span>
                <span className="badge-blue capitalize">{user.role}</span>
                <button onClick={logout} className="btn-secondary text-sm py-1.5">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm py-1.5">Log in</Link>
                <Link href="/register" className="btn-primary text-sm py-1.5">Sign up</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-primary-500/5 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-glass glass-heavy overflow-y-auto">
          {/* User info header */}
          {user && (
            <div className="px-4 py-3 border-b border-glass flex items-center gap-3">
              <UserAvatar name={user.full_name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-theme-primary truncate">{user.full_name}</p>
                <span className="badge-blue capitalize text-xs">{user.role}</span>
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-1">
            <MobileNavLink href="/map" onClick={() => setMobileOpen(false)}>
              Find Stations
            </MobileNavLink>
            {canAccessRoutePlanner(user?.role) && (
              <MobileNavLink href="/route-planner" onClick={() => setMobileOpen(false)}>
                Route Planner
              </MobileNavLink>
            )}
            {user ? (
              <>
                <MobileNavLink href={dashboardPath} onClick={() => setMobileOpen(false)}>
                  Dashboard
                </MobileNavLink>
                <MobileNavLink href="/reservations" onClick={() => setMobileOpen(false)}>
                  Reservations
                </MobileNavLink>

                {/* Smart Features section — customer only */}
                {canAccessSmartFeatures(user.role) && (
                  <>
                    <div className="pt-2 pb-1">
                      <p className="px-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Smart Features</p>
                    </div>
                    {smartFeatures.map((item) => (
                      <MobileNavLink key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                        <span className="pl-3">{item.label}</span>
                      </MobileNavLink>
                    ))}
                  </>
                )}

                {/* Admin section */}
                {user.role === 'admin' && (
                  <>
                    <div className="pt-2 pb-1">
                      <p className="px-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Admin</p>
                    </div>
                    {adminFeatures.map((item) => (
                      <MobileNavLink key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                        <span className="pl-3">{item.label}</span>
                      </MobileNavLink>
                    ))}
                  </>
                )}

                <div className="pt-2 border-t border-glass mt-2">
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>
                  Log in
                </MobileNavLink>
                <Link href="/register" className="block px-3 py-2 rounded-lg text-primary-500 font-medium hover:bg-primary-500/10 transition-colors" onClick={() => setMobileOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
