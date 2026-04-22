import { createClient } from '@supabase/supabase-js';
import { debugLog } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Debug log to confirm env vars are loaded during development only.
debugLog('[Supabase Init] URL:', supabaseUrl ? 'Set' : 'Missing');

if (!isSupabaseConfigured) {
    console.error('[Supabase Init] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. App will run in limited mode until configured.');
}

// Use non-empty placeholders to avoid crashing during module initialization.
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseKey || fallbackAnonKey);

// Shared Helper for Supabase REST API (Bypassing SDK for reliability)
export const supabaseFetch = async (endpoint: string, options: RequestInit = {}, token?: string | null) => {
    if (!isSupabaseConfigured) throw new Error("Missing Supabase configuration");

    const headers: Record<string, string> = {
        apikey: String(supabaseKey),
        'Content-Type': 'application/json'
    };

    if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
            headers[key] = value;
        });
    } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
            headers[key] = value;
        });
    } else if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
            if (value !== undefined) {
                headers[key] = String(value);
            }
        });
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // Ensure endpoint doesn't start with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${supabaseUrl}/rest/v1/${cleanEndpoint}`;

    debugLog(`[Supabase REST] Requesting: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        debugLog(`[Supabase REST] Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase REST Error [${endpoint}]:`, errorText);
            let detail = '';
            try {
                const parsed = errorText ? JSON.parse(errorText) : null;
                const code = parsed?.code ? String(parsed.code) : '';
                const message = parsed?.message ? String(parsed.message) : '';
                const details = parsed?.details ? String(parsed.details) : '';
                detail = [code, message, details].filter(Boolean).join(' | ');
            } catch {
                detail = errorText;
            }

            const suffix = detail ? ` | ${detail}` : '';
            throw new Error(`Supabase API Error: ${response.status} ${response.statusText}${suffix}`);
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