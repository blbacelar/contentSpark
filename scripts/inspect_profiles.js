
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Simple .env parser to avoid dependency
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                env[key.trim()] = value.trim();
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase URL or Service Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectProfiles() {
    console.log("Fetching last 5 users...");

    // Get users from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ perPage: 5 });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No users found.");
        return;
    }

    console.log(`Found ${users.length} users. Checking profiles...`);

    for (const user of users) {
        console.log(`\nUser: ${user.email} (ID: ${user.id})`);
        console.log(`Metadata:`, JSON.stringify(user.user_metadata));

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error(`  -> Profile Fetch Error: ${profileError.message} (${JSON.stringify(profileError.details)})`);
        } else if (!profile) {
            console.error(`  -> No Profile Found!`);
        } else {
            console.log(`  -> Profile:`, profile); // Log the object

            // Check for specific issues
            if (!profile.first_name) console.warn("     [WARN] Missing First Name");
            if (profile.credits === 0) console.warn("     [WARN] Credits are 0");
        }
    }
}

inspectProfiles();
