import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug log to confirm env vars are loaded
console.log('[Supabase Init] URL:', supabaseUrl ? 'Set' : 'Missing');

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Shared Helper for Supabase REST API (Bypassing SDK for reliability)
export const supabaseFetch = async (endpoint: string, options: RequestInit = {}, token?: string | null) => {
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");

    const headers: HeadersInit = {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        ...options.headers as any
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensure endpoint doesn't start with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${supabaseUrl}/rest/v1/${cleanEndpoint}`;

    console.log(`[Supabase REST] Requesting: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log(`[Supabase REST] Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase REST Error [${endpoint}]:`, errorText);
            throw new Error(`Supabase API Error: ${response.status} ${response.statusText}`);
        }

        if (response.status === 204) return null;

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`[Supabase REST] Fetch Error:`, error);
        throw error;
    }
};