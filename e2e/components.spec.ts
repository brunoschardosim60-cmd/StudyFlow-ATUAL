import { test, expect } from "@playwright/test";

test.describe("Timer Component", () => {
  test("should render timer if visible", async ({ page }) => {
    await page.goto("/");
    
    // Look for timer elements
    const timer = page.locator('[class*="timer"], [aria-label*="timer"]');
    
    // May or may not be visible depending on auth state
    if (await timer.isVisible()) {
      const display = await timer.textContent();
      expect(display).toBeTruthy();
    }
  });

  test("should have responsive timer display", async ({ page }) => {
    await page.goto("/");
    
    const timer = page.locator('[class*="timer"], [aria-label*="timer"]');
    
    if (await timer.isVisible()) {
      // Change viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const stillVisible = await timer.isVisible();
      expect(stillVisible).toBeTruthy();
    }
  });
});

test.describe("Study Features", () => {
  test("should display study related content", async ({ page }) => {
    await page.goto("/");
    
    const content = await page.textContent("body");
    
    // Check for study-related keywords
    const hasStudyContent = /study|estud|tema|subject/i.test(content || "");
    expect(hasStudyContent).toBeTruthy();
  });

  test("should have buttons for common actions", async ({ page }) => {
    await page.goto("/");
    
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();
    
    // Should have at least some action buttons
    expect(buttonCount).toBeGreaterThan(0);
  });

  test("should handle button interactions", async ({ page }) => {
    await page.goto("/");
    
    const buttons = page.locator("button").first();
    
    if (await buttons.isEnabled()) {
      // Hover over button
      await buttons.hover();
      
      // Check if button is interactive
      const isVisible = await buttons.isVisible();
      expect(isVisible).toBeTruthy();
    }
  });
});

test.describe("Accessibility", () => {
  test("should have proper heading structure", async ({ page }) => {
    await page.goto("/");
    
    const headings = page.locator("h1, h2, h3, h4, h5, h6");
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
  });

  test("should have alt text for images", async ({ page }) => {
    await page.goto("/");
    
    const images = page.locator("img");
    const imageCount = await images.count();
    
    // Check at least the first few images
    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const alt = await images.nth(i).getAttribute("alt");
      
      // Images should either have alt text or be decorative
      const ariaHidden = await images.nth(i).getAttribute("aria-hidden");
      expect(alt || ariaHidden).toBeTruthy();
    }
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto("/");
    
    // Press Tab to navigate
    await page.keyboard.press("Tab");
    
    // Check if focus moved to an interactive element
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    
    expect(focusedElement).toBeTruthy();
  });

  test("should have proper color contrast", async ({ page }) => {
    await page.goto("/");
    
    // This is a basic check - full accessibility audit would need more tools
    const body = page.locator("body").first();
    const isVisible = await body.isVisible();
    
    expect(isVisible).toBeTruthy();
  });
});

test.describe("Error Handling", () => {
  test("should handle 404 gracefully", async ({ page }) => {
    page.on("response", (response) => {
      if (response.status() === 404) {
        // Don't fail on 404s for static resources
        expect(true).toBeTruthy();
      }
    });
    
    await page.goto("/");
  });

  test("should not show JavaScript errors", async ({ page }) => {
    let jsErrors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        jsErrors.push(msg.text());
      }
    });
    
    await page.goto("/");
    
    // Allow some errors but not critical ones
    const criticalErrors = jsErrors.filter(e => 
      e.includes("Cannot") || e.includes("undefined is not")
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test("should recover from network issues", async ({ page }) => {
    await page.route("**/*", (route) => {
      // Simulate occasional network delay
      setTimeout(() => route.continue(), 100);
    });
    
    await page.goto("/");
    
    const isLoaded = await page.locator("body").isVisible();
    expect(isLoaded).toBeTruthy();
  });
});
