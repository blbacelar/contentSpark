import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing TEST_SUPABASE_URL and/or TEST_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const args = process.argv.slice(2);

const getArgValue = (name) => {
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
};

const email = getArgValue('email') || process.env.TEST_USER_EMAIL;
const userIdArg = getArgValue('user-id');
const creditsArg = getArgValue('credits') || '30';
const credits = Number(creditsArg);

if (!Number.isFinite(credits) || credits < 0) {
  console.error(`Invalid --credits value: ${creditsArg}`);
  process.exit(1);
}

if (!email && !userIdArg) {
  console.error('Provide --email or --user-id (or TEST_USER_EMAIL in .env.test).');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

const findUserIdByEmail = async (targetEmail) => {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    throw new Error(`Unable to list users: ${error.message}`);
  }

  const target = (data.users || []).find((u) => (u.email || '').toLowerCase() === targetEmail.toLowerCase());
  return target?.id || null;
};

const run = async () => {
  const userId = userIdArg || (email ? await findUserIdByEmail(email) : null);

  if (!userId) {
    throw new Error(`Could not resolve user id for email: ${email}`);
  }

  const { error } = await admin
    .from('profiles')
    .update({ credits })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update credits: ${error.message}`);
  }

  console.log(`Updated credits to ${credits} for user ${userId}${email ? ` (${email})` : ''}.`);
};

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
