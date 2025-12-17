
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("Inspecting 'content_ideas'...");
    // Try to fetch one row with * to see keys
    const { data: ideas, error: ideaError } = await supabase
        .from('content_ideas')
        .select('*')
        .limit(1);

    if (ideaError) {
        console.error("Error fetching content_ideas:", ideaError);
    } else if (ideas && ideas.length > 0) {
        console.log("content_ideas columns:", Object.keys(ideas[0]).join(', '));
    } else {
        console.log("content_ideas is empty, cannot inspect keys easily via select");
    }

    console.log("\nInspecting 'personas'...");
    const { data: personas, error: personaError } = await supabase
        .from('personas')
        .select('*')
        .limit(1);

    if (personaError) {
        console.error("Error fetching personas:", personaError);
    } else if (personas && personas.length > 0) {
        console.log("personas columns:", Object.keys(personas[0]).join(', '));
    } else {
        console.log("personas is empty");
    }
}

inspect();
