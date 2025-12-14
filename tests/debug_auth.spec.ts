import { test, expect } from './fixtures';

test('Debug Authentication State', async ({ page, loggedInUser }) => {
    console.log('DEBUG: Starting Auth Test');

    await page.goto('/app');
    await page.waitForTimeout(3000); // Let it settle

    const currentUrl = page.url();
    console.log('DEBUG: Current URL:', currentUrl);

    const title = await page.title();
    console.log('DEBUG: Page Title:', title);

    const localStorageSession = await page.evaluate(() => {
        return window.localStorage.getItem('sb-tciqwxkdukfbflhiziql-auth-token');
    });
    console.log('DEBUG: LocalStorage Session present?', !!localStorageSession);
    if (localStorageSession) {
        console.log('DEBUG: Session length:', localStorageSession.length);
    }

    const bodyText = await page.locator('body').textContent();
    console.log('DEBUG: Body Start:', bodyText?.substring(0, 500));

    await page.screenshot({ path: 'test-results/debug-auth.png' });

    await expect(page).toHaveURL(/\/app/);
});
