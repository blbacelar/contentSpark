
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase URL or Service Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectProfiles() {
    console.log("Fetching last 5 users...");

    // Get users from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ perPage: 5 }); // sort? listUsers doesn't sort easily, gives latest.

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
        console.log(`Metadata:`, user.user_metadata);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error(`  -> Profile Fetch Error: ${profileError.message} (${profileError.details})`);
        } else if (!profile) {
            console.error(`  -> No Profile Found!`);
        } else {
            console.log(`  -> Profile:`, profile);
        }
    }
}

inspectProfiles();
