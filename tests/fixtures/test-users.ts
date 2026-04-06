export const USERS = {
  customer: {
    email: 'customer@evcharge.com',
    password: 'password123',
    role: 'customer' as const,
  },
  manager: {
    email: 'manager1@evcharge.com',
    password: 'password123',
    role: 'manager' as const,
  },
  admin: {
    email: 'admin@evcharge.com',
    password: 'admin123',
    role: 'admin' as const,
  },
} as const;

export type TestUser = typeof USERS[keyof typeof USERS];
