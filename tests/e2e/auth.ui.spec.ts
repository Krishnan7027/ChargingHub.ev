import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { USERS } from '../fixtures/test-users';

test.describe('Auth Flow — UI', () => {
  test('Login page renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
  });

  test('Customer login → redirects to /customer', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.customer.email, USERS.customer.password);
    await loginPage.expectRedirectTo('/customer');

    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
  });

  test('Admin login → redirects to /admin', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.admin.email, USERS.admin.password);
    await loginPage.expectRedirectTo('/admin');
  });

  test('Invalid password → shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.customer.email, 'wrongpassword');
    await loginPage.expectError('Invalid');
  });

  test('Unauthenticated access to /customer redirects to login', async ({ page }) => {
    await page.goto('/customer');
    // Should redirect to login or show login prompt
    await page.waitForURL('**/login*', { timeout: 10_000 });
  });
});
