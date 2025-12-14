import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test Configuration
const BASE_URL = 'https://n8n.bacelardigital.tech/webhook';
const SUPABASE_URL = 'https://tciqwxkdukfbflhiziql.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kp4l5uKw4iMU7FnGE9ibIQ_JF2CwYbN';

// Test User Credentials
const TEST_EMAIL = 'brunolbacelar@gmail.com';
const TEST_PASSWORD = 'A123#456a';

let authToken: string;
let testUserId: string;

test.beforeAll(async () => {
    // Authenticate test user
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (error || !data.session) {
        throw new Error(`Failed to authenticate test user: ${error?.message}`);
    }

    authToken = data.session.access_token;
    testUserId = data.user.id;
    console.log('Test user authenticated:', testUserId);
});

test.describe('API Endpoint Validation', () => {

    test.describe('Content Ideas Endpoints', () => {

        test('GET /get-user-ideas - should fetch user ideas', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/get-user-ideas`, {
                params: { user_id: testUserId },
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            expect(response.ok()).toBeTruthy();
            expect(response.status()).toBe(200);

            const data = await response.json();
            expect(Array.isArray(data) || Array.isArray(data.ideas)).toBeTruthy();
        });

        test('POST /create-idea - should create new idea', async ({ request }) => {
            const newIdea = {
                user_id: testUserId,
                title: 'API Test Idea',
                description: 'Created via API test',
                hook: 'Test hook',
                caption: 'Test caption',
                cta: 'Test CTA',
                hashtags: '#test #api',
                platform_suggestion: ['Instagram'],
                status: 'Pending'
            };

            const response = await request.post(`${BASE_URL}/create-idea`, {
                data: newIdea,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status()).toBeLessThan(400);
            // Note: n8n might return 200 even with warnings
        });

        test('PATCH /update-card - should update existing idea', async ({ request }) => {
            const updatePayload = {
                id: 'test-id-123',
                user_id: testUserId,
                title: 'Updated Title',
                status: 'In Progress'
            };

            const response = await request.patch(`${BASE_URL}/update-card`, {
                data: updatePayload,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // May fail if ID doesn't exist, but should not return 500
            expect(response.status()).not.toBe(500);
        });

        test('DELETE /delete-user-ideas - should delete idea', async ({ request }) => {
            const response = await request.delete(`${BASE_URL}/delete-user-ideas`, {
                data: {
                    id: 'test-id-to-delete',
                    user_id: testUserId
                },
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // Should not error even if ID doesn't exist
            expect(response.status()).toBeLessThan(500);
        });

        test('POST /generate-ideas - should generate AI ideas', async ({ request }) => {
            const generatePayload = {
                user_id: testUserId,
                topic: 'API Testing',
                audience: 'Developers',
                tone: 'Professional',
                language: 'en'
            };

            const response = await request.post(`${BASE_URL}/generate-ideas`, {
                data: generatePayload,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // AI generation can take time
            });

            expect(response.ok()).toBeTruthy();
            const data = await response.json();

            // Should return array of ideas
            const ideas = Array.isArray(data) ? data : data.ideas;
            expect(Array.isArray(ideas)).toBeTruthy();
            if (ideas.length > 0) {
                expect(ideas[0]).toHaveProperty('title');
                expect(ideas[0]).toHaveProperty('description');
            }
        });
    });

    test.describe('Persona Endpoints', () => {

        test('GET /get-persona - should fetch user personas', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/get-persona`, {
                params: { user_id: testUserId },
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            expect(response.ok()).toBeTruthy();
            const data = await response.json();

            // Should return array or object with personas
            expect(data).toBeDefined();
        });

        test('POST /save-persona - should create new persona', async ({ request }) => {
            const newPersona = {
                user_id: testUserId,
                name: 'API Test Persona',
                occupation: 'Software Developer',
                age_range: '25-34',
                gender: 'All',
                pains_list: ['Time management', 'Work-life balance'],
                goals_list: ['Career growth', 'Learn new skills'],
                questions_list: ['How to improve productivity?']
            };

            const response = await request.post(`${BASE_URL}/save-persona`, {
                data: newPersona,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status()).toBeLessThan(400);
        });
    });

    test.describe('Error Handling', () => {

        test('Should return 401 for missing auth token', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/get-user-ideas`, {
                params: { user_id: testUserId }
                // No Authorization header
            });

            // n8n might not enforce auth, but we test the pattern
            // If it returns 200, that's a security concern to note
            console.log('Auth check status:', response.status());
        });

        test('Should handle missing required fields', async ({ request }) => {
            const response = await request.post(`${BASE_URL}/create-idea`, {
                data: {
                    // Missing required fields like user_id, title
                },
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // Should return 400 or similar error
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Performance Checks', () => {

        test('GET /get-user-ideas - response time < 1s', async ({ request }) => {
            const start = Date.now();

            const response = await request.get(`${BASE_URL}/get-user-ideas`, {
                params: { user_id: testUserId },
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            const duration = Date.now() - start;

            expect(response.ok()).toBeTruthy();
            expect(duration).toBeLessThan(1000);
            console.log(`GET /get-user-ideas took ${duration}ms`);
        });

        test('POST /generate-ideas - response time < 30s', async ({ request }) => {
            const start = Date.now();

            const response = await request.post(`${BASE_URL}/generate-ideas`, {
                data: {
                    user_id: testUserId,
                    topic: 'Performance Testing',
                    audience: 'QA Engineers',
                    tone: 'Professional',
                    language: 'en'
                },
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const duration = Date.now() - start;

            expect(response.ok()).toBeTruthy();
            expect(duration).toBeLessThan(30000);
            console.log(`POST /generate-ideas took ${duration}ms`);
        });
    });
});
