import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly navbar: Locator;
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = page.locator('nav');
    this.userMenu = page.locator('nav button').last();
  }

  async expectLoaded() {
    await expect(this.navbar).toBeVisible();
  }

  async expectUrl(path: string) {
    expect(this.page.url()).toContain(path);
  }
}
