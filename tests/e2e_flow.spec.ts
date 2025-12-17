import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read fixtures
const personaFixture = JSON.parse(fs.readFileSync(path.resolve('tests', 'fixtures', 'persona.json'), 'utf-8'));
const ideasFixture = JSON.parse(fs.readFileSync(path.resolve('tests', 'fixtures', 'generated_ideas.json'), 'utf-8'));

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tciqwxkdukfbflhiziql.supabase.co';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

test.describe('E2E User Flow: Sign In -> Profile -> Persona -> Ideas', () => {
    let userEmail: string;
    let userId: string;

    test.use({ locale: 'en-US' });

    test.beforeEach(async () => {
        const timestamp = Date.now();
        userEmail = `e2e.test.${timestamp}@gmail.com`;
    });

    test.afterEach(async () => {
        if (serviceRoleKey && userEmail) {
            const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
            const { data: { users } } = await adminSupabase.auth.admin.listUsers();
            // @ts-ignore
            const user = users?.find(u => u.email === userEmail);
            if (user) {
                await adminSupabase.auth.admin.deleteUser(user.id);
                console.log(`[Teardown] Deleted test user: ${userEmail}`);
            }
        }
    });

    test('should complete the full user journey successfully', async ({ page }) => {
        if (!serviceRoleKey) {
            test.skip(true, 'Service Role Key required for this test');
            return;
        }

        // --- 1. SETUP USER ---
        console.log(`Creating test user: ${userEmail}`);

        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: createError } = await adminSupabase.auth.admin.createUser({
            email: userEmail,
            password: 'password123',
            email_confirm: true,
            user_metadata: {
                first_name: 'E2E',
                last_name: 'Tester'
            }
        });

        if (createError || !user) {
            throw new Error(`Failed to create test user: ${createError?.message}`);
        }
        userId = user.id;

        // SKIP ONBOARDING via DB
        // Wait a moment for DB trigger to create profile
        await page.waitForTimeout(1000);
        await adminSupabase.from('profiles').update({ has_completed_onboarding: true }).eq('id', userId);

        // --- 2. LOGIN FLOW ---
        await page.goto('/login');
        await page.fill('input[type="email"]', userEmail);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Wait for redirect to app
        await page.waitForURL('**/app');

        // --- 3. PROFILE & PERSONA FLOW ---

        // Wait for Sidebar to load
        await expect(page.locator('button:has-text("New Strategy")')).toBeVisible();

        // Click Profile (User Avatar at bottom left)
        // Using structural selector for robustness (Bottom of sidebar)
        const profileButton = page.locator('div.border-t.border-gray-200 > button').last();
        await expect(profileButton).toBeVisible({ timeout: 10000 });

        // Force click to ensure navigation even if something (like a tour tooltip) overlaps slightly
        await profileButton.click({ force: true });

        // Wait for potential data fetching/rendering
        await page.waitForLoadState('networkidle');

        // Verify we are on Profile view
        // Wait for First Name input first to ensure page mount
        await expect(page.getByPlaceholder('Jane')).toBeVisible({ timeout: 15000 });

        // Use accessible heading selector for Brand Kit with Regex for robustness
        await expect(page.getByRole('heading', { name: /Brand Kit/i })).toBeVisible();

        // Create New Persona
        // Fill Identity Tab
        await page.fill('input[placeholder="e.g. Corporate Execs, Busy Moms..."]', personaFixture.name);

        console.log('Selecting Gender...');
        // Gender Select - Use more specific selector to avoid ambiguity
        const genderContainer = page.locator('.space-y-2', { hasText: 'Gender' });
        await genderContainer.locator('button[role="combobox"]').click({ force: true });
        await page.locator(`div[role="option"]:has-text("${personaFixture.gender}")`).click({ force: true });

        console.log('Filling Age Range...');
        // Age Range
        await page.fill('input[placeholder="e.g., 25-34"]', personaFixture.age_range);

        console.log('Filling Occupation...');
        // Occupation
        await page.fill('input[placeholder="e.g., Marketing Manager"]', personaFixture.occupation);

        // Education Select
        const selectByLabel = async (label: string, value: string) => {
            console.log(`Selecting ${label} with value ${value}...`);
            const container = page.locator('.space-y-2', { hasText: label }).first();
            await container.locator('button[role="combobox"]').click({ force: true });

            // Wait for listbox to serve options
            const option = page.locator(`div[role="option"]:has-text("${value}")`);
            try {
                await option.waitFor({ state: 'visible', timeout: 3000 });
                await option.click({ force: true });
            } catch (e) {
                console.log(`Failed to click option ${value}. Retrying open...`);
                await container.locator('button[role="combobox"]').click({ force: true });
                await option.click({ force: true });
            }
        };

        await selectByLabel('Education', personaFixture.education);
        await selectByLabel('Marital Status', personaFixture.marital_status);

        // Social Networks
        for (const network of personaFixture.social_networks.split(',')) {
            await page.click(`button[aria-label="Toggle ${network}"]`);
        }

        console.log('Filling Pains...');
        // Pains
        await page.getByRole('tab', { name: /Pains/i }).click();
        await page.fill('input[placeholder="e.g., Can\'t find time to cook healthy meals"]', personaFixture.pains_list[0]);
        await page.click('button:has-text("Add another")');
        await page.fill('input[placeholder="e.g., Can\'t find time to cook healthy meals"] >> nth=1', personaFixture.pains_list[1]);

        // Save Persona
        await page.click('button:has-text("Save Strategy")');

        // Verify Toast Success
        await expect(page.getByText('Persona saved successfully!')).toBeVisible();

        // --- 4. IDEA GENERATION FLOW ---

        // Go Back to Calendar
        await page.click('button:has-text("Back to Calendar")');

        // Reload to ensure fresh data (personas) are fetched
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Click New Strategy
        await page.click('button:has-text("New Strategy")');

        // Verify Modal
        await expect(page.getByRole('heading', { name: 'Strategy Engine' })).toBeVisible();

        // Fill Form
        await page.fill('input[name="topic"]', 'Modern E2E Testing');
        // Ensure audience is filled (even if persona prefills it, explicit fill is safer or verify it)
        await page.fill('input[name="audience"]', 'QA Engineers');

        // Select Persona
        const personaTrigger = page.locator('.space-y-2', { hasText: 'Target Persona' }).locator('button[role="combobox"]');
        await personaTrigger.click({ force: true });

        const personaOption = page.locator(`div[role="option"]:has-text("${personaFixture.name}")`);
        try {
            await personaOption.waitFor({ state: 'visible', timeout: 5000 });
            await personaOption.click({ force: true });
        } catch (e) {
            console.log("Retry clicking Persona option...");
            await personaTrigger.click({ force: true }); // toggle again
            await personaOption.click({ force: true });
        }

        // MOCK GENERATION API
        await page.route(process.env.VITE_GENERATE_IDEAS_URL || '**/webhook/generate-ideas', async route => {
            console.log("Mocking Idea Generation Webhook...");
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ideas: ideasFixture })
            });
        });

        // Click Generate
        await page.click('button:has-text("Generate Magic")');

        // Verify Side Panel has the new ideas
        await expect(page.locator(`h4:has-text("${ideasFixture[0].title}")`)).toBeVisible({ timeout: 15000 });
        await expect(page.locator(`h4:has-text("${ideasFixture[1].title}")`)).toBeVisible();

        console.log("Test Completed Successfully");
    });
});
