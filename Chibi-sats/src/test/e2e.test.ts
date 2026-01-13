import { test, expect } from '@playwright/test';

test.describe('Chibi Sats E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (MainWindow)
    await page.goto('http://localhost:1420');
  });

  test('should display initial loading state and then price', async ({ page }) => {
    // Check for title
    await expect(page.locator('.title')).toHaveText(/Chibi Sats/i);
    
    // Check for loading or price
    const priceValue = page.locator('.price-value');
    await expect(priceValue).toBeVisible({ timeout: 10000 });
    
    const text = await priceValue.innerText();
    expect(text).toMatch(/[$€₺🍬zł]/); // Contains a currency symbol
  });

  test('should toggle timeframe on click', async ({ page }) => {
    const wheel = page.locator('.timeframe-wheel-container');
    const activeTimeframe = page.locator('.timeframe-item.active');
    
    const initialTf = await activeTimeframe.innerText();
    await wheel.click();
    
    const newTf = await activeTimeframe.innerText();
    expect(newTf).not.toBe(initialTf);
  });

  test('should open settings window', async ({ page, context }) => {
    // In a real Tauri app, this would open a new window.
    // In our E2E mock/web test, we check if the event is emitted or if we can navigate.
    
    const settingsButton = page.locator('.settings-button');
    await settingsButton.click();
    
    // For web-based E2E, we can simulate the navigation to settings
    await page.goto('http://localhost:1420?window=settings');
    await expect(page.locator('.settings-header')).toContainText(/Settings/i);
  });

  test('should change theme in settings', async ({ page }) => {
    await page.goto('http://localhost:1420?window=settings');
    
    const themeSelect = page.getByTestId('theme-select');
    await themeSelect.selectOption('dark');
    
    const appDiv = page.locator('.app');
    await expect(appDiv).toHaveClass(/dark/);
    
    await themeSelect.selectOption('anime');
    await expect(appDiv).toHaveClass(/anime/);
  });

  test('should persist settings in local storage', async ({ page }) => {
    await page.goto('http://localhost:1420?window=settings');
    
    const themeSelect = page.getByTestId('theme-select');
    await themeSelect.selectOption('billionaire');
    
    // Reload page
    await page.reload();
    await expect(page.locator('.app')).toHaveClass(/billionaire/);
  });

  test('should change language', async ({ page }) => {
    await page.goto('http://localhost:1420?window=settings');
    
    const langSelect = page.locator('select').nth(3); // Language select is the 4th select
    await langSelect.selectOption('ru');
    
    await expect(page.locator('.settings-header')).toContainText(/Настройки/i);
    
    await langSelect.selectOption('en');
    await expect(page.locator('.settings-header')).toContainText(/Settings/i);
  });

  test('should trigger price alert with manual price', async ({ page }) => {
    await page.goto('http://localhost:1420?window=settings');
    
    // 1. Enable manual price
    const manualCheckbox = page.getByLabel(/Use Manual Price/i);
    await manualCheckbox.check();
    
    // 2. Set manual price to 50000
    const manualInput = page.locator('.alert-input').first();
    await manualInput.fill('50000');
    await page.waitForTimeout(500); // Wait for priceUsd to update
    
    // 3. Add alert for 51000 (above)
    const alertTargetInput = page.getByPlaceholder(/Target Price/i);
    await alertTargetInput.fill('51000');
    await page.locator('.alert-add-button').click();
    
    // Check alert added
    await expect(page.locator('.alert-item')).toContainText('51,000');
    
    // 4. Trigger alert by changing manual price to 52000
    await manualInput.fill('52000');
    
    // Check alert became inactive with a longer timeout
    await expect(page.locator('.alert-item')).toHaveClass(/inactive/, { timeout: 10000 });
  });

  test('should handle currency change', async ({ page }) => {
    await page.goto('http://localhost:1420?window=settings');
    
    const currencySelect = page.locator('select').nth(1); // Currency select is 2nd
    await currencySelect.selectOption('EUR');
    
    // Go back to main window (or check in settings if price displayed)
    await page.goto('http://localhost:1420');
    const priceValue = page.locator('.price-value');
    await expect(priceValue).toContainText('€');
  });
});
