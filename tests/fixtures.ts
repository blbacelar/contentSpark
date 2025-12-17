import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables
const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseKey = process.env.TEST_SUPABASE_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('TEST_SUPABASE_URL and TEST_SUPABASE_KEY must be set in .env.test');
}

if (!testEmail || !testPassword) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test');
}

const supabase = createClient(supabaseUrl, supabaseKey);

type MyFixtures = {
    loggedInUser: { email: string; id: string };
};

export const test = base.extend<MyFixtures>({
    loggedInUser: async ({ page }, use) => {
        // 1. Log in via API (Faster and less prone to UI timeout if UI is slow under load)
        const { data, error } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword,
        });

        if (error || !data.session) {
            throw new Error(`Failed to log in test user via API: ${error?.message}`);
        }

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
        await use({ email: testEmail, id: data.user?.id || '' });
    },
});

export { expect } from '@playwright/test';
