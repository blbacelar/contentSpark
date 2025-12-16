
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log("Starting Quick Check...");

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

    supabase.from('debug_logs').select('*').limit(10)
        .then(({ data: logs, error }) => {
            console.log("\n--- Debug Logs ---");
            if (error) console.error("Error fetching logs:", error);
            else {
                if (logs.length === 0) console.log("No error logs found.");
                else console.log(JSON.stringify(logs, null, 2));
            }

            // Check mismatches
            return supabase.auth.admin.listUsers({ perPage: 10 });
        })
        .then(async ({ data: { users }, error }) => {
            console.log("\n--- User Profile Check ---");
            if (error) { console.error("Auth Error:", error); return; }

            for (const u of users) {
                const { data: p } = await supabase.from('profiles').select('id, first_name, credits').eq('id', u.id).single();

                const hasName = p && p.first_name;
                const hasCredits = p && p.credits > 0;

                if (!p) {
                    console.error(`[CRITICAL] User ${u.email} missing profile!`);
                } else if (!hasName || !hasCredits) {
                    console.warn(`[ISSUE] User ${u.email}: Name='${p.first_name}', Credits=${p.credits}`);
                    console.log(`Metadata:`, JSON.stringify(u.user_metadata));
                } else {
                    console.log(`[OK] User ${u.email}`);
                }
            }
        });

} catch (e) {
    console.error("Script Error:", e);
}
