import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env file (for dev)
dotenv.config();

// Load test-specific environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const viteSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.TEST_SUPABASE_URL || '';
const viteSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_KEY || '';
const isCI = !!process.env.CI;
const headedMode = process.env.PW_HEADED === 'true';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: isCI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: isCI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:3000',

        /* Default to headless; opt into headed mode with PW_HEADED=true. */
        headless: !headedMode,

        /* Keep video artifacts focused on failures to reduce I/O. */
        video: 'retain-on-failure',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        env: {
            ...process.env,
            VITE_SUPABASE_URL: viteSupabaseUrl,
            VITE_SUPABASE_ANON_KEY: viteSupabaseAnonKey,
            VITE_E2E_DISABLE_TOUR: 'true',
        },
    },
});
