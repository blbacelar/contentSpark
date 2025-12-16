import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client for setup/teardown
// Note: In a real CI environment, we would use a Service Role Key to delete users.
// Here we rely on the Anon Key for public operations, and might be limited in cleanup capability 
// unless the VITE_SUPABASE_SERVICE_ROLE_KEY is passed in env.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tciqwxkdukfbflhiziql.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// If we don't have service role, we can't easily delete users from auth.users.
// We might just leave them or try to delete associated data.

test.describe('Onboarding Flow', () => {
    let userEmail: string;
    let userId: string;

    test.beforeEach(async () => {
        // Generate unique email
        const timestamp = Date.now();
        userEmail = `test.onboarding.${timestamp}@gmail.com`;
    });

    test.use({ locale: 'en-US' });

    test('should login and complete onboarding tour', async ({ page }) => {
        // Listen for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`BROWSER ERROR: "${msg.text()}"`);
        });
        page.on('pageerror', err => {
            console.log(`BROWSER EXCEPTION: ${err.message}`);
        });

        // Listen for 500 Network Errors
        page.on('response', async response => {
            if (response.status() >= 400) {
                console.log(`NETWORK ERROR [${response.status()}] ${response.url()}`);
                try {
                    const body = await response.text();
                    console.log(`BODY: ${body}`);
                } catch (e) {
                    console.log('Could not read body');
                }
            }
        });

        if (!serviceRoleKey) {
            test.skip(true, 'Service Role Key required for this test');
            return;
        }

        // 0. Create User via Admin API (Bypass Rate Limits)
        console.log(`Creating test user: ${userEmail}`);
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: createError } = await adminSupabase.auth.admin.createUser({
            email: userEmail,
            password: 'password123',
            email_confirm: true,
            user_metadata: {
                first_name: 'Test',
                last_name: 'User'
            }
        });

        if (createError || !user) {
            console.error("Failed to create test user:", createError);
            throw new Error("Failed to create test user");
        }
        userId = user.id;

        // Verify Profile exists (DEBUG)
        const { data: profileData, error: profileError } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        console.log("DEBUG: Created User Profile:", profileData);
        if (profileError || !profileData) {
            console.error("Profile NOT found for created user. Trigger failed?", profileError);
        }

        // 1. Go to Login Page
        await page.goto('/login');

        // 2. Fill Login Form
        await page.fill('input[placeholder="you@company.com"]', userEmail);
        await page.fill('input[placeholder="••••••••"]', 'password123');
        await page.click('button[type="submit"]');

        // 3. Wait for Redirect to Home
        await page.waitForURL('**/app', { timeout: 15000 });
        console.log("Logged in successfully. URL: ", page.url());

        // 4. Verify Onboarding Tour
        console.log("Waiting for Onboarding Tour...");
        // Step 1: "Welcome to ContentSpark"
        // Wait for the text to appear. If it doesn't, the tour didn't start.
        try {
            await expect(page.locator('text=Welcome to ContentSpark!')).toBeVisible({ timeout: 15000 });
        } catch (e) {
            console.log("Tour did not appear. Checking for dashboard content to see if login worked at least.");
            // If tour fails, maybe user_settings didn't trigger 'has_completed_onboarding' correctly?
            // Or maybe it's true by default? (No, default is false).
            // Let's check if we see "Dashboard"
            if (await page.locator('text=Dashboard').isVisible()) {
                console.log("Dashboard is visible, but tour missing.");
            }
            throw e;
        }

        console.log("Step 1 Visible. Clicking Next...");

        // Robust Next Button Selector
        const nextButton = page.locator('button', { hasText: /^Next$/ }).first();
        await nextButton.click();

        // 5. Verify Step 2 (Team Switcher)
        console.log("Waiting for Step 2...");

        // Ensure the Sidebar is rendered and the ID exists (which was the original bug)
        // logic: step 2 targets #tour-team-switcher
        await expect(page.locator('#tour-team-switcher')).toBeVisible({ timeout: 10000 });

        // Also check Joyride tooltip content
        await expect(page.locator('text=Manage your teams here')).toBeVisible({ timeout: 5000 });

        console.log("Step 2 passed (No Crash!)");
    });

    test.afterEach(async () => {
        if (serviceRoleKey && userEmail) {
            const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
            const { data: { users } } = await adminSupabase.auth.admin.listUsers();
            // @ts-ignore
            const user = users?.find(u => u.email === userEmail);
            if (user) {
                await adminSupabase.auth.admin.deleteUser(user.id);
                console.log(`Deleted test user: ${userEmail}`);
            }
        }
    });

});
