import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Teams Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Login flow
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[type="email"]', 'brunolbacelar@gmail.com');
        await page.fill('input[type="password"]', 'A123#456a');
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/app`);
    });

    test('should allow creating a team and switching to it', async ({ page }) => {
        // 1. Open Team Switcher
        await page.click('button:has-text("Personal Workspace")');

        // 2. Click Create Team
        await page.click('text=Create New Team');

        // 3. Fill Form
        const teamName = `Test Team ${Date.now()}`;
        await page.fill('input[placeholder*="Team Name"]', teamName);
        await page.click('button:has-text("Create Team")');

        // 4. Verify Switch (Automatic or Manual)
        // Expect the switcher button to now show the new team name
        await expect(page.locator('button:has-text("' + teamName + '")').first()).toBeVisible();

        // 5. Create an Idea in the Team
        // Open Create Modal (if not open)
        // Actually the dashboard has a "Generate" button or "Manual Create" button.
        // Let's use Manual Create if available, or just check that we are in the team context.

        // 6. Switch back to Personal
        await page.click(`button:has-text("${teamName}")`); // Open dropdown
        await page.click('text=Personal Workspace');

        // 7. Verify we are back in Personal
        await expect(page.locator('button:has-text("Personal Workspace")').first()).toBeVisible();
    });
});
