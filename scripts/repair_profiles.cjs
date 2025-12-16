
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runRepair() {
    console.log("Starting Profile Repair...");

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

        // 1. Get all users (paginate)
        let allUsers = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: page, perPage: 50 });
            if (error) throw error;
            if (!users || users.length === 0) {
                hasMore = false;
            } else {
                allUsers = allUsers.concat(users);
                page++;
            }
        }

        console.log(`Found ${allUsers.length} total users.`);

        for (const user of allUsers) {
            // 2. Check profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            const meta = user.user_metadata || {};
            const firstName = meta.first_name || (meta.full_name ? meta.full_name.split(' ')[0] : '') || meta.name || '';
            const lastName = meta.last_name || (meta.full_name ? meta.full_name.split(' ').slice(1).join(' ') : '') || '';

            if (!profile) {
                console.log(`[REPAIR] Creating missing profile for ${user.email}`);
                const { error: insertError } = await supabase.from('profiles').insert({
                    id: user.id,
                    email: user.email,
                    first_name: firstName,
                    last_name: lastName,
                    credits: 4,
                    tier: 'Free',
                    has_completed_onboarding: false
                });
                if (insertError) console.error(`  -> Failed: ${insertError.message}`);
            } else {
                // 3. Check for missing data
                const updates = {};
                if (!profile.first_name && firstName) updates.first_name = firstName;
                if (!profile.last_name && lastName) updates.last_name = lastName;
                if (!profile.email) updates.email = user.email;
                if ((profile.credits === undefined || profile.credits === null) && updates.credits !== 0) updates.credits = 4; // Don't overwrite if 0? Actually, if null, set 4.

                if (Object.keys(updates).length > 0) {
                    console.log(`[REPAIR] Updating profile for ${user.email}:`, updates);
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update(updates)
                        .eq('id', user.id);
                    if (updateError) console.error(`  -> Failed: ${updateError.message}`);
                }
            }

            // 4. Check user_settings
            const { data: settings } = await supabase.from('user_settings').select('user_id').eq('user_id', user.id).single();
            if (!settings) {
                console.log(`[REPAIR] Creating missing settings for ${user.email}`);
                await supabase.from('user_settings').insert({
                    user_id: user.id,
                    notify_on_team_join: true,
                    notify_on_idea_due: true,
                    idea_due_threshold_hours: 24
                });
            }
        }

        console.log("Repair Complete.");

    } catch (e) {
        console.error("Script Error:", e);
    }
}

runRepair();
