import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tciqwxkdukfbflhiziql.supabase.co';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Helpers for User Management
const createTestUser = async (email: string) => {
    if (!serviceRoleKey) throw new Error('Service Role Key missing');
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error } = await adminSupabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { first_name: 'Test', last_name: 'User' }
    });
    if (error || !user) throw new Error(`Failed to create user ${email}: ${error?.message}`);

    // Skip onboarding
    await new Promise(r => setTimeout(r, 1000));
    await adminSupabase.from('profiles').update({ has_completed_onboarding: true }).eq('id', user.id);

    return user.id;
};

const deleteTestUser = async (email: string) => {
    if (!serviceRoleKey) return;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { users } } = await adminSupabase.auth.admin.listUsers();
    // @ts-ignore
    const user = users?.find(u => u.email === email);
    if (user) {
        await adminSupabase.auth.admin.deleteUser(user.id);
        console.log(`[Teardown] Deleted user: ${email}`);
    }
};

test.describe('Teams Feature', () => {
    let ownerEmail: string;
    let inviteeEmail: string;

    test.use({ locale: 'en-US' });

    test.beforeEach(async ({ page }) => {
        if (!serviceRoleKey) test.skip(true, 'Service Role Key required');

        const timestamp = Date.now();
        ownerEmail = `owner.${timestamp}@gmail.com`;
        inviteeEmail = `invitee.${timestamp}@gmail.com`;

        // Create Owner only initially
        await createTestUser(ownerEmail);

        // Login as Owner
        await page.goto('/login');
        await page.fill('input[type="email"]', ownerEmail);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/app');
    });

    test.afterEach(async () => {
        await deleteTestUser(ownerEmail);
        // Only delete invitee if it was created
        if (inviteeEmail) await deleteTestUser(inviteeEmail);
    });

    test('should allow creating a team and switching to it', async ({ page }) => {
        const switcherBtn = page.locator('#tour-team-switcher button').first();
        await expect(switcherBtn).toBeVisible();
        await switcherBtn.click({ force: true });

        await page.click('text=Create New Team');

        const teamName = `Owner Team ${Date.now()}`;
        await page.fill('input[placeholder*="Team Name"]', teamName);
        await page.click('button:has-text("Create Team")');

        await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
        await expect(page.getByText(teamName)).toBeVisible();
        console.log(`Created team: ${teamName}`);
    });

    test('should invite a user to a team', async ({ page }) => {
        // 1. Create Team
        const switcherBtn = page.locator('#tour-team-switcher button').first();
        await expect(switcherBtn).toBeVisible();
        await switcherBtn.click({ force: true });

        await page.getByText(/Create New Team|Criar Nova Equipe/i).click();

        const teamName = `Invite Team ${Date.now()}`;
        await page.fill('input[placeholder*="Team Name"]', teamName);
        await page.click('button:has-text("Create Team")');

        // Wait for switch
        await expect(page.getByText(teamName)).toBeVisible();

        // 2. Get Invite Link
        await switcherBtn.click({ force: true });
        await page.getByText(/Invite Members|Convidar Membros/i).click();

        const inviteInput = page.locator('input[readonly]');
        await expect(inviteInput).toBeVisible();
        const inviteUrl = await inviteInput.inputValue();
        console.log(`Invite URL: ${inviteUrl}`);

        // Close modal
        await page.keyboard.press('Escape');

        // 3. Logout Owner
        // Click avatar then logout (assuming standard UI)
        // Or clearer: Clear cookies/storage to force logout
        await page.context().clearCookies();
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForURL('**/login');

        // 4. Create & Login Invitee
        console.log(`Creating Invitee: ${inviteeEmail}`);
        await createTestUser(inviteeEmail);

        await page.fill('input[type="email"]', inviteeEmail);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/app');

        // 5. Visit Invite Link
        // The URL is fully qualified, so we can just goto it
        await page.goto(inviteUrl);

        // 6. Verify Join Success Page
        // Check for specific success message from JoinTeamPage
        await expect(page.getByText(`Welcome to ${teamName}`)).toBeVisible({ timeout: 15000 });
        console.log('Join success message verified');

        // 7. Verify Redirect and Active Team
        // Wait for redirect to app
        await page.waitForURL('**/app', { timeout: 15000 });

        // The switcher button should now show the NEW team name (auto-switch logic in JoinPage)
        const newSwitcherBtn = page.locator('#tour-team-switcher button').first();
        await expect(newSwitcherBtn).toHaveText(new RegExp(teamName), { timeout: 10000 });

        console.log(`Invitee successfully joined and switched to team: ${teamName}`);
    });
});
