'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCountry } from '@/context/CountryContext';
import { getCountryList } from '@/lib/countries';
import { canAccessRoutePlanner, canAccessSmartFeatures, getSmartFeatures } from '@/lib/roles';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { dropdownVariants, buttonHover, buttonTap } from '@/lib/animations';

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
    <motion.div
      ref={ref}
      variants={dropdownVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute top-full left-0 mt-1 w-48 glass-heavy rounded-xl py-1 z-50"
    >
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-theme-muted">{label}</p>
      {items.map((item, i) => (
        <motion.div
          key={item.href}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03, duration: 0.2 }}
        >
          <Link
            href={item.href}
            className="block px-3 py-2 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors rounded-lg mx-1"
            onClick={onClose}
          >
            {item.label}
          </Link>
        </motion.div>
      ))}
    </motion.div>
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
        <motion.span
          layoutId="nav-indicator"
          className="absolute -bottom-[1.19rem] left-0 right-0 h-0.5 bg-primary-500 rounded-full"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
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
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="w-8 h-8 bg-primary-500/15 text-primary-500 rounded-full flex items-center justify-center text-sm font-semibold cursor-pointer"
    >
      {name.charAt(0)}
    </motion.div>
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
      <motion.button
        whileHover={buttonHover}
        whileTap={buttonTap}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:text-primary-500 transition-colors px-2 py-1 rounded-lg hover:bg-primary-500/5"
      >
        <span className="text-base">{country.flag}</span>
        <span className="hidden sm:inline">{country.code}</span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full right-0 mt-1 w-48 glass-heavy rounded-xl py-1 z-50"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [smartMenuOpen, setSmartMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const navBlur = useTransform(scrollY, [0, 80], [28, 40]);
  const navShadowOpacity = useTransform(scrollY, [0, 80], [0, 0.15]);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 20);
  });

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    <motion.nav
      className="glass-heavy border-b border-glass sticky top-0 z-[1100]"
      animate={{
        paddingTop: scrolled ? '0.25rem' : '0.5rem',
        paddingBottom: scrolled ? '0.25rem' : '0.5rem',
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        backdropFilter: useTransform(navBlur, (v) => `blur(${v}px)`),
        boxShadow: useTransform(navShadowOpacity, (v) => `0 4px 30px rgba(0,0,0,${v})`),
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/25"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </motion.div>
              <span className="text-xl font-bold text-theme-primary">EV Charge Hub</span>
            </Link>

            <div className="hidden md:flex ml-10 gap-6 items-center">
              {user?.role !== 'customer' && (
                <NavLink href="/map">
                  Find Stations
                </NavLink>
              )}
              {user?.role !== 'customer' && canAccessRoutePlanner(user?.role) && (
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
                    <motion.svg
                      animate={{ rotate: smartMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </button>
                  <AnimatePresence>
                    {smartMenuOpen && (
                      <DropdownMenu label="Features" items={smartFeatures} onClose={() => setSmartMenuOpen(false)} />
                    )}
                  </AnimatePresence>
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
                    <motion.svg
                      animate={{ rotate: adminMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </button>
                  <AnimatePresence>
                    {adminMenuOpen && (
                      <DropdownMenu label="Admin" items={adminFeatures} onClose={() => setAdminMenuOpen(false)} />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <CountrySelector />
            {user ? (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => { setProfileMenuOpen(!profileMenuOpen); setSmartMenuOpen(false); setAdminMenuOpen(false); }}
                  className="flex items-center gap-2 hover:bg-primary-500/5 rounded-xl px-2 py-1.5 transition-colors"
                >
                  <UserAvatar name={user.full_name} />
                  <span className="text-sm text-theme-primary font-medium">{user.full_name}</span>
                  <span className="badge-blue capitalize">{user.role}</span>
                  <motion.svg
                    animate={{ rotate: profileMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-3.5 h-3.5 text-theme-muted"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </button>
                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute top-full right-0 mt-2 w-56 glass-heavy rounded-xl py-2 z-50"
                    >
                      {/* User info header */}
                      <div className="px-4 py-2 border-b border-glass mb-1">
                        <p className="text-sm font-semibold text-theme-primary">{user.full_name}</p>
                        <p className="text-xs text-theme-muted">{user.email}</p>
                      </div>

                      <Link
                        href={dashboardPath}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors mx-1 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Dashboard
                      </Link>
                      <Link
                        href="/reservations"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors mx-1 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        My Reservations
                      </Link>
                      <Link
                        href="/charging-history"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors mx-1 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Charging History
                      </Link>
                      <Link
                        href="/favorites"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-theme-secondary hover:bg-primary-500/10 hover:text-primary-500 transition-colors mx-1 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Favorites
                      </Link>

                      <div className="border-t border-glass mt-1 pt-1">
                        <button
                          onClick={() => { logout(); setProfileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors mx-1 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm py-1.5">Log in</Link>
                <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                  <Link href="/register" className="btn-primary text-sm py-1.5 inline-block">Sign up</Link>
                </motion.div>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
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
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="md:hidden overflow-hidden"
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
                {user?.role !== 'customer' && (
                  <MobileNavLink href="/map" onClick={() => setMobileOpen(false)}>
                    Find Stations
                  </MobileNavLink>
                )}
                {user?.role !== 'customer' && canAccessRoutePlanner(user?.role) && (
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
