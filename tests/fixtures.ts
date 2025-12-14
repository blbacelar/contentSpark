import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Re-defining here to avoid import issues with relative paths outside 'tests' in some configs
const supabaseUrl = 'https://tciqwxkdukfbflhiziql.supabase.co';
// Note: This is a publishable key, so it's safe to use in tests.
const supabaseKey = 'sb_publishable_kp4l5uKw4iMU7FnGE9ibIQ_JF2CwYbN';
const supabase = createClient(supabaseUrl, supabaseKey);

type MyFixtures = {
    loggedInUser: { email: string; id: string };
};

export const test = base.extend<MyFixtures>({
    loggedInUser: async ({ page }, use) => {
        // 1. Log in via API (Faster and less prone to UI timeout if UI is slow under load)
        const email = 'brunolbacelar@gmail.com';
        const password = 'A123#456a';

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session) {
            throw new Error(`Failed to log in test user via API: ${error?.message}`);
        }

        // 2. Set LocalStorage via addInitScript before any page load
        const projectRef = 'tciqwxkdukfbflhiziql';
        const storageKey = `sb-${projectRef}-auth-token`;
        const sessionStr = JSON.stringify(data.session);

        await page.addInitScript(({ key, value }) => {
            window.localStorage.setItem(key, value);
            console.log(`[Test Setup] Injected localStorage for ${key}`);
        }, { key: storageKey, value: sessionStr });

        // 3. Provide details
        await use({ email, id: data.user?.id || '' });
    },
});

export { expect } from '@playwright/test';
