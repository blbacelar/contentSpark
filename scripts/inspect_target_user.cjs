
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function inspectTargetUser() {
    const targetId = '99c676fd-3c66-4b26-a9e3-a0c41c271ca4';
    console.log(`Inspecting User: ${targetId}`);

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

        // 1. Check Profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetId)
            .single();

        if (error) {
            console.error("Profile Fetch Error:", error);
        } else {
            console.log("Profile Data:", profile);
        }

        // 2. Check Auth Metadata (to see if name exists there)
        const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(targetId);
        if (authError) {
            console.error("Auth Fetch Error:", authError);
        } else {
            console.log("Auth Metadata:", user.user_metadata);
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

inspectTargetUser();
