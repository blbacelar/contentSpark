import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFetches() {
    const email = `debug.fetch.${Date.now()}@gmail.com`;
    const password = 'password123';

    console.log('1. Signing up user:', email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: 'Debug',
                last_name: 'Fetcher'
            }
        }
    });

    if (authError) {
        console.error('Signup failed:', authError);
        return;
    }
    console.log('Signup success');

    // Wait a moment for triggers
    await new Promise(r => setTimeout(r, 1000));

    const token = authData.session?.access_token;
    if (!token) {
        console.log('No token (email confirm needed?). Trying login...');
        // If confirm needed, we might be stuck unless we use service key to confirm.
        // But for "gmail.com" logic, it usually sends email.
        // Let's assume we can't proceed without confirming if env is clean.
        // But wait, my previous debug script worked and returned a session?
        // Ah, if email confirmation is on, signUp returns session: null.
    }

    // IF we have no session, we can't test RLS protected endpoints.
    // I need to use the service role key to auto-confirm if available?
    // Or assume the problem happens even without confirmation?
    // No, 500 happens after login.

    // Let's use the SERVICE ROLE KEY to confirm the user if possible.
    const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && authData.user) {
        console.log('Auto-confirming email with service key...');
        const adminSupabase = createClient(supabaseUrl, serviceKey);
        await adminSupabase.auth.admin.updateUserById(authData.user.id, { email_confirm: true });

        // Login now
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (loginError) {
            console.error('Login failed:', loginError);
            return;
        }
        testEndpoints(loginData.session.access_token, loginData.user.id);
    } else {
        console.log('No service key or user. Cannot full test endpoints as authenticated user.');
        // Try to test anonymously if possible?
    }
}

async function testEndpoints(token, userId) {
    console.log('--- Testing Endpoints ---');
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const endpoints = [
        `rest/v1/user_settings?user_id=eq.${userId}&select=*`,
        `rest/v1/notifications?user_id=eq.${userId}&select=*`,
        `rest/v1/content_ideas?user_id=eq.${userId}&select=*`,
        `rest/v1/personas?user_id=eq.${userId}&select=*`
    ];

    for (const ep of endpoints) {
        console.log(`fetching ${ep}...`);
        const res = await fetch(`${supabaseUrl}/${ep}`, { headers });
        console.log(`Status: ${res.status}`);
        if (!res.ok) {
            const txt = await res.text();
            console.log(`ERROR BODY: ${txt}`);
        } else {
            console.log('OK');
        }
    }
}

debugFetches();
