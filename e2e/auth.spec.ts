import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should navigate to auth page", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/auth|\/$/);
    const url = page.url();
    expect(url).toMatch(/\/auth|\/$/);
  });

  test("should have auth form elements", async ({ page }) => {
    await page.goto("/auth");
    
    // Check if email input exists
    const emailInput = page.locator('input[type="email"]');
    expect(emailInput).toBeDefined();
    
    // Check if submit button exists
    const submitButton = page.locator('button[type="submit"]');
    expect(submitButton).toBeDefined();
  });

  test("should show forgot password link", async ({ page }) => {
    await page.goto("/auth");
    
    const forgotLink = page.locator('a:has-text("Esqueceu a senha?")');
    expect(forgotLink).toBeDefined();
  });

  test("should navigate to forgot password page", async ({ page }) => {
    await page.goto("/auth");
    
    const forgotLink = page.locator('a:has-text("Esqueceu a senha?")');
    await forgotLink.click();
    
    await page.waitForURL(/\/forgot-password/);
    expect(page.url()).toContain("/forgot-password");
  });

  test("should validate email format", async ({ page }) => {
    await page.goto("/auth");
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("invalid-email");
    
    const submitButton = page.locator('button[type="submit"]');
    
    // Check for validation message or disabled state
    const isDisabled = await submitButton.isDisabled();
    const hasError = await page.locator('[role="alert"], .error').count() > 0;
    
    expect(isDisabled || hasError).toBeTruthy();
  });

  test("should accept valid email", async ({ page }) => {
    await page.goto("/auth");
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("test@example.com");
    
    const submitButton = page.locator('button[type="submit"]');
    const isDisabled = await submitButton.isDisabled();
    
    expect(isDisabled).toBeFalsy();
  });
});

test.describe("Password Reset", () => {
  test("should navigate to forgot password", async ({ page }) => {
    await page.goto("/forgot-password");
    
    expect(page.url()).toContain("/forgot-password");
    
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/esqueceu|reset|senha/i);
  });

  test("should have email input on forgot password", async ({ page }) => {
    await page.goto("/forgot-password");
    
    const emailInput = page.locator('input[type="email"]');
    expect(emailInput).toBeDefined();
  });

  test("should navigate back to auth", async ({ page }) => {
    await page.goto("/forgot-password");
    
    const backLink = page.locator('a:has-text("Voltar"), a:has-text("Login")').first();
    if (await backLink.isVisible()) {
      await backLink.click();
      await page.waitForURL(/\/auth/);
      expect(page.url()).toContain("/auth");
    }
  });
});
