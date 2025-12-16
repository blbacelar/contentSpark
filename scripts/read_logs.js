import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Env Vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function readLogs() {
    console.log('Reading debug logs...');

    const { data, error } = await supabase
        .from('debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Read Logs FAILED:', error);
    } else {
        console.log('--- DEBUG LOGS ---');
        data.forEach(log => {
            console.log(`[${log.created_at}] User: ${log.user_id}`);
            console.log(`Error: ${log.error_message}`);
            console.log(`Details: ${log.error_details}`);
            console.log('------------------');
        });
    }
}

readLogs();
