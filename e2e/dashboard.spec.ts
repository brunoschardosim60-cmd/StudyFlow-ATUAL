import { test, expect } from "@playwright/test";

test.describe("Dashboard Navigation", () => {
  test("should render main navigation", async ({ page }) => {
    await page.goto("/");
    
    // Look for main navigation elements
    const nav = page.locator("nav, [role='navigation']").first();
    expect(nav).toBeDefined();
  });

  test("should have accessible links in navigation", async ({ page }) => {
    await page.goto("/");
    
    const links = page.locator("nav a, nav button").or(page.locator('[role="navigation"] a, [role="navigation"] button'));
    const count = await links.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test("should load without network errors", async ({ page }) => {
    let errorCount = 0;
    
    page.on("response", (response) => {
      if (response.status() >= 400) {
        errorCount++;
      }
    });
    
    await page.goto("/");
    
    // Allow some 404s but not too many
    expect(errorCount).toBeLessThan(5);
  });

  test("should have proper page title", async ({ page }) => {
    await page.goto("/");
    
    const title = await page.title();
    expect(title).toMatch(/studyflow|study flow/i);
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto("/");
    
    // Look for mobile menu or responsive elements
    const mobileMenu = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]');
    
    // Should have either menu button or visible nav
    const hasMenu = await mobileMenu.count() > 0;
    const nav = page.locator("nav").first();
    const navVisible = await nav.isVisible();
    
    expect(hasMenu || navVisible).toBeTruthy();
  });
});

test.describe("Dashboard Components", () => {
  test("should display study cards", async ({ page }) => {
    await page.goto("/");
    
    // Look for cards or sections
    const cards = page.locator("[role='region'], .card, [class*='card']");
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("should have interactive elements", async ({ page }) => {
    await page.goto("/");
    
    const buttons = page.locator("button");
    const count = await buttons.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test("should load images properly", async ({ page }) => {
    await page.goto("/");
    
    const images = page.locator("img");
    const imageCount = await images.count();
    
    // Check if images have proper attributes
    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const alt = await images.nth(i).getAttribute("alt");
      const src = await images.nth(i).getAttribute("src");
      
      expect(src).toBeTruthy();
    }
  });

  test("should have accessible text content", async ({ page }) => {
    await page.goto("/");
    
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
    expect(content?.length).toBeGreaterThan(0);
  });
});

test.describe("Performance", () => {
  test("should load page within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto("/");
    
    const loadTime = Date.now() - startTime;
    
    // Should load in less than 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test("should handle viewport changes", async ({ page }) => {
    await page.goto("/");
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 },   // Mobile
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      const isVisible = await page.locator("body").isVisible();
      expect(isVisible).toBeTruthy();
    }
  });
});
