import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { cleanupTestData, resetUserCredits } from './test-helpers';

// Get credentials from environment variables
const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseKey = process.env.TEST_SUPABASE_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;
const testServiceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('TEST_SUPABASE_URL and TEST_SUPABASE_KEY must be set in .env.test');
}

if (!testEmail || !testPassword) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test');
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getValidPassword(candidate: string): string {
    return candidate.length >= 6 ? candidate : 'E2ETestPassword123!';
}

async function ensureAdminProvisionedUser(email: string, desiredPassword: string): Promise<string> {
    if (!testServiceRoleKey) {
        throw new Error(
            'Invalid test credentials and TEST_SUPABASE_SERVICE_ROLE_KEY is not set. ' +
            'Provide valid TEST_USER_EMAIL/TEST_USER_PASSWORD or configure TEST_SUPABASE_SERVICE_ROLE_KEY for auto-provisioning.'
        );
    }

    const serviceRoleKey = testServiceRoleKey!;
    const adminSupabase = createClient(supabaseUrl!, serviceRoleKey);
    const finalPassword = getValidPassword(desiredPassword);

    const { data: listedUsers, error: listError } = await adminSupabase.auth.admin.listUsers();
    if (listError) {
        throw new Error(`Failed test auth admin lookup: ${listError.message}`);
    }

    const users = (listedUsers.users ?? []) as Array<{ id: string; email?: string | null }>;
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!existing) {
        const { error: createError } = await adminSupabase.auth.admin.createUser({
            email,
            password: finalPassword,
            email_confirm: true,
        });
        if (createError) {
            throw new Error(`Failed test auth admin create user: ${createError.message}`);
        }
        return finalPassword;
    }

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(existing.id, {
        password: finalPassword,
        email_confirm: true,
    });
    if (updateError) {
        throw new Error(`Failed test auth admin update user password: ${updateError.message}`);
    }

    return finalPassword;
}

async function ensureTestSession(email: string, password: string) {
    const signInResult = await supabase.auth.signInWithPassword({ email, password });
    if (!signInResult.error && signInResult.data.session) {
        return signInResult;
    }

    // If credentials are invalid, attempt to create the user so local/dev runs are less brittle.
    if (signInResult.error?.message?.toLowerCase().includes('invalid login credentials')) {
        const provisionedPassword = await ensureAdminProvisionedUser(email, password);
        const retrySignInResult = await supabase.auth.signInWithPassword({ email, password: provisionedPassword });
        if (!retrySignInResult.error && retrySignInResult.data.session) {
            return retrySignInResult;
        }

        throw new Error(
            `Failed test auth after admin auto-provisioning: ${retrySignInResult.error?.message ?? 'no session returned'}.`
        );
    }

    throw new Error(`Failed to log in test user via API: ${signInResult.error?.message}`);
}

type MyFixtures = {
    loggedInUser: { email: string; id: string };
};

export const test = base.extend<MyFixtures>({
    loggedInUser: async ({ page }, use) => {
        // 1. Log in via API (faster and less flaky than UI auth in tests)
        const { data } = await ensureTestSession(testEmail, testPassword);

        // 2. Set LocalStorage via addInitScript before any page load
        // Extract project ref from URL
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
        const storageKey = `sb-${projectRef}-auth-token`;
        const sessionStr = JSON.stringify(data.session);

        await page.addInitScript(({ key, value }) => {
            window.localStorage.setItem(key, value);
            console.log(`[Test Setup] Injected localStorage for ${key}`);
        }, { key: storageKey, value: sessionStr });

        // 3. Provide details
        const userId = data.user?.id || '';

        // 4. Use the fixture
        await use({ email: testEmail, id: userId });

        // 5. Cleanup after test (this runs even if test fails)
        console.log('[Fixture] Cleaning up test data...');
        try {
            await cleanupTestData(userId, false); // Don't delete the auth user
            await resetUserCredits(userId, 10); // Reset credits to default
        } catch (cleanupError) {
            console.error('[Fixture] Cleanup failed:', cleanupError);
            // Don't throw - we don't want cleanup failures to fail the test
        }
    },
});

export { expect } from '@playwright/test';

