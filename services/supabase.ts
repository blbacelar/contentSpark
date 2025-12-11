import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tciqwxkdukfbflhiziql.supabase.co';
const supabaseKey = 'sb_publishable_kp4l5uKw4iMU7FnGE9ibIQ_JF2CwYbN';

export const supabase = createClient(supabaseUrl, supabaseKey);