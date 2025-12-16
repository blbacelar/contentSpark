
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function checkSchema() {
    console.log("Checking Schema...");
    try {
        const envPath = path.resolve(__dirname, '../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                env[parts[0].trim()] = parts.slice(1).join('=').trim();
            }
        });

        const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

        // Simple insert attempt to test schema (transaction rolled back or just check error)
        // Actually, we can just select a single row and see the keys? 
        // Or better: Introspection is hard via JS SDK without direct SQL access.
        // We will try to SELECT email from profiles limit 1.
        // If it fails with "column does not exist", we know.

        console.log("Attempting to select 'email' from 'profiles'...");
        const { data, error } = await supabase.from('profiles').select('email').limit(1);

        if (error) {
            console.error("Schema Check Failed:", error.message);
            if (error.message.includes('does not exist')) {
                console.log(">>> CONFIRMED: Column 'email' is MISSING.");
            }
        } else {
            console.log("Schema Check Passed: 'email' column exists.");
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

checkSchema();
