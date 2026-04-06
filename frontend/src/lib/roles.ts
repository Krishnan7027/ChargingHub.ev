// Centralized role-based access control helpers
// Roles are lowercase strings from the backend: 'customer' | 'manager' | 'admin'

export type UserRole = 'customer' | 'manager' | 'admin';

/** Where each role should land after login */
export function getPostLoginPath(role: string): string {
  switch (role) {
    case 'admin':   return '/admin';
    case 'manager': return '/manager';
    default:        return '/map';
  }
}

/** Whether a role can see Route Planner (customer-only feature) */
export function canAccessRoutePlanner(role?: string): boolean {
  return role === 'customer' || !role; // also show for unauthenticated (public)
}

/** Whether a role can see Smart Features dropdown */
export function canAccessSmartFeatures(role?: string): boolean {
  return role === 'customer';
}

/** Filter smart feature items by role */
export function getSmartFeatures(role?: string) {
  const allFeatures = [
    { href: '/smart-schedule', label: 'Smart Schedule' },
    { href: '/battery-health', label: 'Battery Health' },
    { href: '/range-safety', label: 'Range Safety' },
    { href: '/route-planner', label: 'Route Planner' },
    { href: '/reviews', label: 'Reviews' },
    { href: '/rewards', label: 'Rewards' },
    { href: '/payments', label: 'Payments' },
  ];

  if (role === 'admin' || role === 'manager') {
    // Remove customer-specific features
    return allFeatures.filter(f => !['/route-planner', '/battery-health', '/range-safety', '/smart-schedule'].includes(f.href));
  }

  return allFeatures;
}

/** Route access rules: which roles can access which path prefixes */
const routeRules: { prefix: string; allowedRoles: string[] }[] = [
  { prefix: '/admin',   allowedRoles: ['admin'] },
  { prefix: '/manager', allowedRoles: ['manager'] },
  { prefix: '/customer', allowedRoles: ['customer'] },
];

/** Check if a role is allowed to access a given path */
export function isRouteAllowed(path: string, role?: string): boolean {
  for (const rule of routeRules) {
    if (path.startsWith(rule.prefix)) {
      return role ? rule.allowedRoles.includes(role) : false;
    }
  }
  // All other routes are public or generally accessible
  return true;
}
