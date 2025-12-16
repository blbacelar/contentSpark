
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function checkPolicies() {
    console.log("Checking RLS Policies...");
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

        // Query pg_policies to see what's active on 'profiles'
        const { data, error } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'profiles');

        if (error) {
            // Direct access to pg_policies might be blocked for service role via REST? 
            // Usually valid for postgres role, but maybe not service_role via API if not exposed.
            console.error("Policy Fetch Error (might be permissions):", error.message);

            // Fallback: RPC if available? No.
            // We'll try to reconstruct from what we know or use SQL via migration if needed.
            // Let's assume we can't see them via API and rely on testing access.
        } else {
            console.log("Active Policies on 'profiles':");
            data.forEach(p => console.log(`- ${p.policyname} (${p.cmd}): ${p.qual} / ${p.with_check}`));
        }

        // Test Access: Attempt to read the target user's profile AS that user (mocking not easy via REST without password).
        // But we can verify if public read is allowed?
        // Actually, we can check if RLS is enabled.
        const { data: tableInfo, error: tableError } = await supabase
            .from('pg_tables')
            .select('rowsecurity')
            .eq('tablename', 'profiles')
            .single();

        if (tableInfo) {
            console.log(`RLS Enabled on profiles: ${tableInfo.rowsecurity}`);
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

checkPolicies();
