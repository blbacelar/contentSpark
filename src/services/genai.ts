// GoogleGenerativeAI removed - using Edge Functions
import { parseISO, isValid, format } from "date-fns";
import { ContentIdea, FormData as AppFormData, Tone, PersonaData, BrandingSettings } from "../types";
import { supabase } from "../services/supabase";
import { debugLog } from "../utils/logger";

const CREATE_CHECKOUT_URL = import.meta.env.VITE_CREATE_CHECKOUT_URL;

export const generateId = () => Math.random().toString(36).substr(2, 9);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTIONAL_CONTENT_IDEA_COLUMNS = new Set([
  'hook',
  'caption',
  'cta',
  'hashtags',
  'canva_prompt',
  'platform',
  'platform_suggestion',
  'persona_id',
  'persona_name'
]);

const resolveAuthToken = async (token?: string | null): Promise<string | null> => {
  if (token) return token;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const extractMissingColumnName = (errorMessage: string): string | null => {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist/i,
    /schema cache[^\n]*column\s+"?([a-zA-Z0-9_.]+)"?/i
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].split('.').pop() || match[1];
      return candidate.trim();
    }
  }

  return null;
};

const isSchemaMissingColumnError = (errorMessage: string, columnName: string) => {
  const lowered = errorMessage.toLowerCase();
  return lowered.includes(columnName.toLowerCase()) && (
    lowered.includes('schema cache') ||
    lowered.includes('does not exist') ||
    lowered.includes('could not find')
  );
};

const persistContentIdeaRow = async (
  endpoint: string,
  method: 'POST' | 'PATCH',
  payload: Record<string, any>,
  token: string
) => {
  const candidatePayload: Record<string, any> = { ...payload };
  const serializedPlatform = Array.isArray(candidatePayload.platform)
    ? JSON.stringify(candidatePayload.platform)
    : candidatePayload.platform;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await supabaseFetch(endpoint, {
        method,
        body: JSON.stringify(candidatePayload),
        headers: { 'Prefer': 'return=representation' }
      }, token);
    } catch (error: any) {
      const message = String(error?.message || '');
      const missingColumn = extractMissingColumnName(message);

      if (missingColumn && missingColumn in candidatePayload && OPTIONAL_CONTENT_IDEA_COLUMNS.has(missingColumn)) {
        delete candidatePayload[missingColumn];
        continue;
      }

      if ('platform' in candidatePayload && isSchemaMissingColumnError(message, 'platform')) {
        if (serializedPlatform !== undefined) {
          candidatePayload.platform_suggestion = serializedPlatform;
        }
        delete candidatePayload.platform;
        continue;
      }

      if ('platform_suggestion' in candidatePayload && isSchemaMissingColumnError(message, 'platform_suggestion')) {
        delete candidatePayload.platform_suggestion;
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to persist content idea after schema compatibility retries');
};

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeBrandKitPDF = async (file: File): Promise<BrandingSettings> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('analyze-brand-kit', {
      body: formData,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("PDF Analysis failed:", error);
    // @ts-ignore
    const msg = error.message || "Unknown error";
    throw new Error(`Failed to analyze PDF: ${msg}`);
  }
};



// --- Caching Helpers ---
const CACHE_PREFIX = 'CS_CACHE_V2_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// Export a safe helper to check cache
export const getCachedIdeas = (userId: string): ContentIdea[] | null => {
  return getCache<ContentIdea[]>(`${CACHE_PREFIX}IDEAS_${userId}`);
};

const getCache = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const cached: CacheItem<T> = JSON.parse(item);

    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
};

const setCache = (key: string, data: any) => {
  try {
    const cacheItem: CacheItem<any> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
  } catch (e) {
    console.warn("Cache write failed", e);
  }
};

const invalidateCache = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("Cache clear failed", e);
  }
}

// --- Helper for Retries & Auth ---
// --- Helper for Retries & Auth ---
export const fetchWithRetry = async (url: string, options: RequestInit, retries = 1, token: string): Promise<Response> => {
  // console.log("DEBUG: fetchWithRetry start", url);
  try {
    if (!token) {
      throw new Error("Authentication token required for services");
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    // Add Timeout (60s) for AI content generation which can be slow
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    const finalOptions = { ...options, headers, signal: controller.signal };

    try {
      debugLog("DEBUG: Executing fetch...");
      const response = await fetch(url, finalOptions);
      debugLog("DEBUG: Fetch returned", response.status);
      clearTimeout(timeoutId);

      // If server is overwhelmed (custom 500 or 503 from some backends), or explicitly tells us to wait
      if (response.status === 503 || response.status === 429) {
        throw new Error("Server busy");
      }

      // Check for specific error messages in text if status is error-like
      if (!response.ok) {
        const clone = response.clone();
        const text = await clone.text();
        if (text.includes("overwhelmed") || text.includes("database is busy")) {
          throw new Error("Server overwhelmed");
        }
      }

      return response;
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error("DEBUG: Fetch error", fetchErr.name, fetchErr.message);
      if (fetchErr.name === 'AbortError') {
        throw new Error("Request timed out (server slow)");
      }
      throw fetchErr;
    }
  } catch (err: any) {
    console.error("FetchWithRetry failed:", err.message);
    if (retries > 0 && (err.message.includes("busy") || err.message.includes("overwhelmed") || err.message.includes("timed out"))) {
      await new Promise(res => setTimeout(res, 2000)); // Wait 2s
      return fetchWithRetry(url, options, retries - 1, token);
    }
    throw err;
  }
};

// --- Services ---

export const fetchUserIdeas = async (userId: string, teamId?: string, token?: string): Promise<ContentIdea[]> => {
  const sanitizeIdea = (idea: Partial<ContentIdea>): ContentIdea => ({
    id: String(idea.id || generateId()),
    title: typeof idea.title === 'string' && idea.title.trim() ? idea.title : 'Untitled Idea',
    description: typeof idea.description === 'string' ? idea.description : '',
    hook: typeof idea.hook === 'string' ? idea.hook : '',
    caption: typeof idea.caption === 'string' ? idea.caption : '',
    cta: typeof idea.cta === 'string' ? idea.cta : '',
    hashtags: typeof idea.hashtags === 'string' ? idea.hashtags : '',
    canva_prompt: typeof idea.canva_prompt === 'string' ? idea.canva_prompt : '',
    platform: Array.isArray(idea.platform) && idea.platform.length > 0 ? idea.platform : ['General'],
    date: idea.date ?? null,
    time: idea.time ?? null,
    status: idea.status || 'Pending',
    created_at: idea.created_at,
    team_id: idea.team_id,
    persona_id: idea.persona_id,
    persona_name: idea.persona_name
  });

  const cacheKey = teamId ? `${CACHE_PREFIX}IDEAS_${teamId}` : `${CACHE_PREFIX}IDEAS_${userId}`;

  // Try cache only for personal mode. Team mode can drift quickly and must prefer DB freshness.
  if (!teamId) {
    const cached = getCache<ContentIdea[]>(cacheKey);
    if (cached && cached.length > 0) {
      const sanitizedCached = cached.map(sanitizeIdea);
      setCache(cacheKey, sanitizedCached);
      return sanitizedCached;
    }
  }

  try {
    if (!token) {
      console.warn("fetchUserIdeas called without token");
      return [];
    }

    let ideas: any[] = [];

    if (teamId) {
      // Team mode: include team-scoped rows plus legacy rows with NULL team_id for this user.
      const [teamRows, legacyRows] = await Promise.all([
        supabaseFetch(
          `content_ideas?select=*&team_id=eq.${teamId}&order=created_at.desc`,
          { method: 'GET' },
          token
        ),
        supabaseFetch(
          `content_ideas?select=*&user_id=eq.${userId}&team_id=is.null&order=created_at.desc`,
          { method: 'GET' },
          token
        )
      ]);

      const merged = [...(teamRows || []), ...(legacyRows || [])];
      const deduped = new Map<string, any>();
      for (const row of merged) {
        if (row?.id) deduped.set(String(row.id), row);
      }

      ideas = Array.from(deduped.values()).sort((a, b) => {
        const aTs = new Date(a?.created_at || 0).getTime();
        const bTs = new Date(b?.created_at || 0).getTime();
        return bTs - aTs;
      });
    } else {
      // Personal mode
      const data = await supabaseFetch(
        `content_ideas?select=*&user_id=eq.${userId}&order=created_at.desc`,
        { method: 'GET' },
        token
      );
      ideas = data || [];
    }

    // Normalize data structure
    const normalizedIdeas = ideas.map((idea: any) => {
      // Platform normalization (stored as text array or similar in postgres).
      // Support both legacy and current column names.
      // Platform normalization logic
      let platforms: string[] = ["General"];
      const rawPlatform = idea.platform || idea.platform_suggestion;

      if (Array.isArray(rawPlatform)) {
        platforms = rawPlatform;
      } else if (typeof rawPlatform === 'string') {
        const trimmed = rawPlatform.trim();
        // Robust JSON parsing
        try {
          // Attempt JSON parse first for things that look like arrays
          if (trimmed.startsWith('[') || trimmed.includes('"')) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) platforms = parsed;
            else platforms = [trimmed];
          } else {
            // Fallback to comma-separated
            platforms = trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()) : [trimmed];
          }
        } catch (e) {
          // Final fallback: treat as single string or comma split
          platforms = trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()) : [trimmed];
        }
      }

      // Parse scheduled_at for date/time
      let date = idea.date || null;
      let time = idea.time || null;

      if (idea.scheduled_at) {
        try {
          // Robust Date Parsing
          const dateObj = new Date(idea.scheduled_at);
          if (!isNaN(dateObj.getTime())) {
            date = format(dateObj, 'yyyy-MM-dd');
            time = format(dateObj, 'HH:mm');
          } else {
            console.warn("Invalid Date found:", idea.scheduled_at);
          }
        } catch (e) {
          console.warn("Failed to parse scheduled_at", idea.scheduled_at);
        }
      }

      return {
        id: idea.id,
        title: idea.title || "Untitled",
        description: idea.description || "",
        hook: idea.hook || "",
        caption: idea.caption || "",
        cta: idea.cta || "",
        hashtags: idea.hashtags || "",
        canva_prompt: idea.canva_prompt || "",
        platform: platforms,
        date: date,
        time: time,
        status: idea.status || 'Pending',
        created_at: idea.created_at,
        team_id: idea.team_id,
        user_id: idea.user_id,
        persona_id: idea.persona_id
      };
    });

    const sanitizedIdeas = normalizedIdeas.map(sanitizeIdea);
    setCache(cacheKey, sanitizedIdeas);
    return sanitizedIdeas;

  } catch (error) {
    console.error("Error fetching user ideas via Supabase:", error);
    return [];
  }
};

export const updateContent = async (payload: Partial<ContentIdea>, userId?: string, token?: string) => {
  let previousCache: ContentIdea[] | null = null;
  const teamCacheKey = payload.team_id ? `${CACHE_PREFIX}IDEAS_${payload.team_id}` : "";
  const userCacheKey = userId ? `${CACHE_PREFIX}IDEAS_${userId}` : "";
  const cacheKey = teamCacheKey || userCacheKey;

  // Optimistically update cache if userId is present
  if (userId && payload.id) {
    previousCache = getCache<ContentIdea[]>(cacheKey);
    if (previousCache) {
      const updated = previousCache.map(i => i.id === payload.id ? { ...i, ...payload } : i);
      setCache(cacheKey, updated);
    }
  }

  try {
    const resolvedToken = await resolveAuthToken(token);

    if (!resolvedToken) {
      // We might want to throw or just log warning? 
      // For drag/drop, if no token, we can't save to DB.
      throw new Error("Auth required for updateContent");
    }

    const updatePayload: any = {
      ...payload
    };

    // Persist schedule using the actual schema columns.
    if ('date' in payload) {
      updatePayload.date = payload.date ?? null;
    }

    if ('time' in payload) {
      updatePayload.time = payload.time ?? null;
    } else if (payload.date && !updatePayload.time) {
      updatePayload.time = '09:00';
    }

    // Remove fields that shouldn't be updated or are flattened/invalid for DB
    delete updatePayload.id;
    delete updatePayload.user_id;
    delete updatePayload.persona_id;
    delete updatePayload.persona_name; // Computed/joined field

    const idValue = String(payload.id || '');
    const isPersistedUuid = UUID_REGEX.test(idValue);

    if (!isPersistedUuid) {
      if (!userId) {
        throw new Error('User ID required to persist a new idea draft');
      }

      const createPayload = {
        ...updatePayload,
        user_id: userId
      };

      const inserted = await persistContentIdeaRow('content_ideas', 'POST', createPayload, resolvedToken);

      return inserted?.[0] ?? null;
    }

    const updatedRows = await persistContentIdeaRow(
      `content_ideas?id=eq.${payload.id}`,
      'PATCH',
      updatePayload,
      resolvedToken
    );

    return updatedRows?.[0] ?? null;

  } catch (error) {
    console.error("Failed to update content via Supabase:", error);
    // Rollback cache
    if (cacheKey && previousCache) {
      setCache(cacheKey, previousCache);
    }
    throw error;
  }
};

export const createContentIdea = async (idea: ContentIdea, userId: string, token: string) => {
  // Optimistically update cache
  const cacheKey = idea.team_id ? `${CACHE_PREFIX}IDEAS_${idea.team_id}` : `${CACHE_PREFIX}IDEAS_${userId}`;
  const cached = getCache<ContentIdea[]>(cacheKey) || [];

  // Save specific ID added for rollback
  const optimisticId = idea.id;

  // Avoid duplicates in cache if possible
  if (!cached.some(i => i.id === optimisticId)) {
    setCache(cacheKey, [...cached, idea]);
  }

  try {
    const resolvedToken = await resolveAuthToken(token);
    if (!resolvedToken) {
      throw new Error('Auth required for createContentIdea');
    }

    const payload: any = {
      ...idea,
      user_id: userId,
      team_id: idea.team_id
    };

    payload.date = idea.date ?? null;
    payload.time = idea.date ? (idea.time || '09:00') : (idea.time ?? null);
    delete payload.persona_id;
    delete payload.persona_name;

    const data = await persistContentIdeaRow('content_ideas', 'POST', payload, resolvedToken);

    return data?.[0] ?? null;
  } catch (error) {
    console.error("Failed to create content via Supabase:", error);

    // Rollback: Remove the optimistically added idea
    const currentCache = getCache<ContentIdea[]>(cacheKey);
    if (currentCache) {
      setCache(cacheKey, currentCache.filter(i => i.id !== optimisticId));
    }

    throw error;
  }
};

export const deleteContent = async (id: string, userId?: string, token?: string) => {
  if (userId) {
    const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey);
    if (cached) {
      setCache(cacheKey, cached.filter(i => i.id !== id));
    }
  }

  try {
    const resolvedToken = await resolveAuthToken(token);
    if (!resolvedToken) throw new Error("Auth required for delete");

    if (!UUID_REGEX.test(id)) {
      // Local draft never persisted to DB, nothing to delete remotely.
      return;
    }

    await supabaseFetch(`content_ideas?id=eq.${id}`, {
      method: 'DELETE'
    }, resolvedToken);

  } catch (error) {
    console.error("Failed to delete content via Supabase:", error);
  }
};

import { supabaseFetch } from "../services/supabase";

// --- Team Branding ---
export const fetchTeamBranding = async (teamId: string, token: string): Promise<BrandingSettings | null> => {
  try {
    const data = await supabaseFetch(`teams?id=eq.${teamId}&select=branding`, {
      method: 'GET'
    }, token);

    if (data && data.length > 0) {
      return data[0].branding as BrandingSettings;
    }
    return null;
  } catch (error) {
    console.error("Fetch Team Branding failed:", error);
    return null;
  }
};

export const updateTeamBranding = async (teamId: string, branding: BrandingSettings, token: string) => {
  try {
    await supabaseFetch(`teams?id=eq.${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ branding })
    }, token);
  } catch (error) {
    console.error("Update Team Branding failed:", error);
    throw error;
  }
};

export const fetchPersonas = async (userId: string, teamId: string | null = null, token?: string): Promise<PersonaData[]> => {
  // Cache key includes teamId if present, else falls back to userId (legacy)
  const cacheKey = teamId ? `${CACHE_PREFIX}PERSONAS_TEAM_${teamId}` : `${CACHE_PREFIX}PERSONAS_${userId}`;

  // Try Cache First
  const cached = getCache<PersonaData[]>(cacheKey);
  if (cached) return cached;

  try {
    if (!token) {
      return [];
    }

    // If Team ID is provided, strictly filter by team_id
    // If not, fall back to user_id (Backwards compatibility or Personal Team)
    const query = teamId
      ? `personas?team_id=eq.${teamId}&select=*&order=created_at.desc`
      : `personas?user_id=eq.${userId}&select=*&order=created_at.desc`;

    const data = await supabaseFetch(query, {
      method: 'GET'
    }, token);

    if (data) {
      const personas: PersonaData[] = data.map((p: any) => ({
        ...p,
        // Ensure arrays
        pains_list: p.pains_list || [],
        goals_list: p.goals_list || [],
        questions_list: p.questions_list || []
      }));
      setCache(cacheKey, personas);
      return personas;
    }
    return [];

  } catch (err) {
    console.error("Error fetching personas via Supabase:", err);
    return [];
  }
};

// (Function fetchPersonas ends correctly at line 537 in previous read, so I need to remove the trailing garbage)

export const fetchUserPersona = async (userId: string, token: string): Promise<PersonaData | null> => {
  // Deprecated for direct use, fetches the most recent persona
  const personas = await fetchPersonas(userId, null, token);
  return personas.length > 0 ? personas[0] : null;
};

export const createPersona = async (persona: PersonaData, userId?: string, token?: string) => {
  try {
    if (!token) throw new Error("Auth required for createPersona");

    // POST /rest/v1/personas
    const payload = {
      name: persona.name,
      gender: persona.gender,
      age_range: persona.age_range,
      occupation: persona.occupation,
      education: persona.education,
      marital_status: persona.marital_status,
      has_children: persona.has_children,
      income_level: persona.income_level,
      social_networks: persona.social_networks,
      description: persona.description || '',
      user_id: userId || persona.user_id,
      team_id: persona.team_id, // Include Team ID
      // Clean up lists to ensure they are arrays
      pains_list: persona.pains_list || [],
      goals_list: persona.goals_list || [],
      questions_list: persona.questions_list || []
    };
    const data = await supabaseFetch('personas', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Prefer': 'return=representation' }
    }, token);

    const created = data?.[0];

    // Optimistic Cache Update: Add to cache
    // We need to invalidate both user and team caches potentially
    const cacheKeyUser = `${CACHE_PREFIX}PERSONAS_${userId || persona.user_id}`;
    const cacheKeyTeam = persona.team_id ? `${CACHE_PREFIX}PERSONAS_TEAM_${persona.team_id}` : null;

    // Invalidate instead of smart update for simplicity in multi-context
    invalidateCache(cacheKeyUser);
    if (cacheKeyTeam) invalidateCache(cacheKeyTeam);

    return created;

  } catch (err) {
    console.error("Error creating persona via Supabase:", err);
    throw err;
  }
};
// End of createPersona


export const saveUserPersona = async (persona: PersonaData, token?: string) => {
  // Legacy support: Just create or update based on if we find one? 
  // actually, let's make this create a new one if it has no ID, or update if it does.
  if (persona.id) {
    return updateUserPersona(persona, token);
  } else {
    return createPersona(persona, persona.user_id, token);
  }
};

export const deletePersona = async (id: string, userId: string, token?: string) => {
  try {
    if (!token) throw new Error("Auth required for delete");

    // DELETE /rest/v1/personas?id=eq.{id}&user_id=eq.{userId}
    await supabaseFetch(`personas?id=eq.${id}&user_id=eq.${userId}`, {
      method: 'DELETE'
    }, token);

    // Optimistic Cache Update: Remove from cache
    const cacheKey = `${CACHE_PREFIX}PERSONAS_${userId}`;
    const cached = getCache<PersonaData[]>(cacheKey);
    if (cached) {
      setCache(cacheKey, cached.filter(p => p.id !== id));
    }

  } catch (err) {
    console.error("Error deleting persona via Supabase:", err);
    throw err;
  }
};

export const updateUserPersona = async (persona: PersonaData, token?: string) => {
  try {
    if (!persona.id) throw new Error("Persona ID required for update");
    if (!token) throw new Error("Auth required for update");

    const updatePayload = {
      name: persona.name,
      gender: persona.gender,
      age_range: persona.age_range,
      occupation: persona.occupation,
      education: persona.education,
      marital_status: persona.marital_status,
      has_children: persona.has_children,
      income_level: persona.income_level,
      social_networks: persona.social_networks,
      pains_list: persona.pains_list || [],
      goals_list: persona.goals_list || [],
      questions_list: persona.questions_list || [],
      description: persona.description || ''
    };

    // PATCH /rest/v1/personas?id=eq.{id}
    const data = await supabaseFetch(`personas?id=eq.${persona.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updatePayload)
    }, token);

    const updated = data?.[0];

    // Optimistic Cache Update: Update item in cache
    const cacheKey = `${CACHE_PREFIX}PERSONAS_${persona.user_id}`;
    const cached = getCache<PersonaData[]>(cacheKey);
    if (cached && updated) {
      setCache(cacheKey, cached.map(p => p.id === updated.id ? updated : p));
    } else {
      invalidateCache(cacheKey);
    }

    return { success: true, data: updated };

  } catch (err) {
    console.error("Error updating persona via Supabase:", err);
    throw err;
  }
};

export const generateContent = async (
  formData: AppFormData,
  userId?: string,
  persona?: PersonaData | null,
  language: string = 'en',
  teamId?: string,
  token?: string,
  branding?: BrandingSettings
): Promise<ContentIdea[]> => {

  const parseIdeasFromModelText = (text: string): Array<Record<string, unknown>> => {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    // First try direct JSON parsing.
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed as Omit<ContentIdea, 'id' | 'date' | 'status'>[];
      if (Array.isArray((parsed as any)?.ideas)) return (parsed as any).ideas as Omit<ContentIdea, 'id' | 'date' | 'status'>[];
    } catch {
      // Fall through to array slice parsing.
    }

    // Fallback: extract first JSON array in the response.
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const arraySlice = cleaned.slice(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(arraySlice);
      if (Array.isArray(parsed)) return parsed as Omit<ContentIdea, 'id' | 'date' | 'status'>[];
    }

    throw new Error('Model response was not valid JSON ideas array');
  };

  const firstNonEmptyString = (...values: unknown[]): string => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  };

  const normalizePlatforms = (...values: unknown[]): string[] => {
    for (const value of values) {
      if (Array.isArray(value)) {
        const cleaned = value
          .filter((item): item is string => typeof item === 'string')
          .map(item => item.trim())
          .filter(Boolean);

        if (cleaned.length > 0) return cleaned;
      }

      if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              const cleaned = parsed
                .filter((item): item is string => typeof item === 'string')
                .map(item => item.trim())
                .filter(Boolean);
              if (cleaned.length > 0) return cleaned;
            }
          } catch {
            // Fallback to comma split below.
          }
        }

        const split = trimmed.split(',').map(item => item.trim()).filter(Boolean);
        if (split.length > 0) return split;
      }
    }

    return ['General'];
  };

  const normalizeGeneratedIdea = (rawIdea: Record<string, unknown>) => {
    const title = firstNonEmptyString(rawIdea.title, rawIdea.Title);
    const hook = firstNonEmptyString(rawIdea.hook, rawIdea.Hook);
    const description = firstNonEmptyString(rawIdea.description, rawIdea.Description);
    const caption = firstNonEmptyString(
      rawIdea.caption,
      rawIdea.Caption,
      rawIdea.full_caption,
      rawIdea['Full Caption']
    );
    const cta = firstNonEmptyString(rawIdea.cta, rawIdea.CTA, rawIdea['Call to Action']);
    const hashtags = firstNonEmptyString(rawIdea.hashtags, rawIdea.Hashtags);
    const platform = normalizePlatforms(
      rawIdea.platform,
      rawIdea.Platform,
      rawIdea.social_media_platforms,
      rawIdea['Social Media Platforms']
    );

    return {
      title: title || 'Untitled Idea',
      hook,
      description: description || hook || caption || '',
      caption,
      cta,
      hashtags,
      platform
    };
  };

  // ... (personaPayload construction unchanged)

  const personaPayload = persona ? {
    name: persona.name || "",
    description: persona.description || "",
    gender: persona.gender || "",
    age_range: persona.age_range || "",
    occupation: persona.occupation || "",
    education: persona.education || "",
    marital_status: persona.marital_status || "",
    has_children: persona.has_children || false,
    income_level: persona.income_level || "",
    social_networks: persona.social_networks || "",
    pains_list: Array.isArray(persona.pains_list) ? persona.pains_list : [],
    goals_list: Array.isArray(persona.goals_list) ? persona.goals_list : [],
    questions_list: Array.isArray(persona.questions_list) ? persona.questions_list : [],
  } : {};

  // ... (lines 600-630 skipped for brevity in search, wait replace_file_content replaces a block)
  // I need to be careful. I will use multi_replace for 2 separate edits.


  let generatedIdeas: ContentIdea[] = [];

  // Supabase Edge Function Implementation
  try {
      // Prompt Construction (Kept in Client for now to reuse logic)


      let personaContext = "";
      if (persona) {
        const painsStr = (persona.pains_list || []).filter(s => s && s.trim()).map(s => `- ${s}`).join('\n') || persona.pain_points || "N/A";
        const goalsStr = (persona.goals_list || []).filter(s => s && s.trim()).map(s => `- ${s}`).join('\n') || persona.goals || "N/A";
        const questionsStr = (persona.questions_list || []).filter(s => s && s.trim()).map(s => `- ${s}`).join('\n') || "N/A";

        personaContext = `
            Target Persona Context:
            - Name: ${persona.name}
            - Description: ${persona.description || "N/A"}
            - Occupation: ${persona.occupation}
            - Age Range: ${persona.age_range}
            - Social Networks: ${persona.social_networks}
            
            Pain Points & Frustrations:
            ${painsStr}

            Dreams & Goals:
            ${goalsStr}

            Burning Questions:
            ${questionsStr}
            `;
      }

      const safeTopic = (formData.topic || "").replace(/`/g, "'");
      const safeAudience = (formData.audience || "").replace(/`/g, "'");
      const safeTone = (formData.tone || "").replace(/`/g, "'");
      const brandingStyle = branding?.style || 'N/A';
      const brandingColors = Array.isArray(branding?.colors)
        ? branding.colors.join(', ')
        : 'N/A';

      const prompt = `
        Generate 6 unique, creative, and high-quality content ideas in ${language.startsWith('pt') ? 'Portuguese' : 'English'}.
        
        Context:
        - Niche/Topic: ${safeTopic}
        - Target Audience: ${safeAudience}
        - Tone: ${safeTone}
        ${personaContext}

        Branding Context:
        - Style: ${brandingStyle}
        - Brand Colors: ${brandingColors}
        
        For each idea, provide:
        1. A catchy Title
        2. A Hook (The first sentence/attention grabber)
        3. A short Description (Internal summary of the idea)
        4. A full Caption (The actual post body text, engaging and formatted)
        5. A Call to Action (CTA)
        6. A set of relevant Hashtags (string format e.g. "#tag1 #tag2")
        7. A list of suitable Social Media Platforms
        `;

      // Supabase Edge Function Call
      // Do not force a bearer token here because some environments issue tokens
      // with algorithms rejected by the Edge gateway (e.g. ES256).
      const invokeOptions: {
        body: { prompt: string; language: string };
      } = {
        body: {
          prompt,
          // We pass context vars too just in case the backend wants to log or use them later,
          // though currently it relies on the 'prompt' string.
          language
        }
      };

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('generate-content', invokeOptions);

      if (edgeError) {
        let detailedMessage = edgeError.message;
        const responseContext = (edgeError as { context?: Response }).context;

        if (responseContext) {
          try {
            const responseBody = await responseContext.text();
            if (responseBody) {
              detailedMessage = `${detailedMessage} | ${responseBody}`;
            }
          } catch {
            // Best-effort only: keep original message if response parsing fails.
          }
        }

        throw new Error(`Edge Function failed: ${detailedMessage}`);
      }

      const text = edgeData?.text;
      if (!text) {
        const details = typeof edgeData === 'object' ? JSON.stringify(edgeData) : String(edgeData);
        throw new Error(`Edge Function returned empty content. Payload: ${details}`);
      }

      const rawIdeas = parseIdeasFromModelText(text);
      if (!rawIdeas.length) {
        throw new Error('AI returned zero ideas');
      }

      generatedIdeas = rawIdeas.map(rawIdea => {
        const normalizedIdea = normalizeGeneratedIdea(rawIdea);

        return {
          ...normalizedIdea,
          id: generateId(),
          date: null,
          time: null,
          status: 'Pending',
          team_id: teamId,
          persona_id: persona?.id,
          persona_name: persona?.name
        };
      });

  } catch (error) {
    console.error("AI generation failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate content via AI Strategy Team: ${message}`);
  }

  let ideasToReturn = generatedIdeas;

  // Persist generated ideas immediately so they are not lost on refresh before drag/edit.
  if (userId && generatedIdeas.length > 0) {
    const resolvedToken = await resolveAuthToken(token);
    if (!resolvedToken) {
      throw new Error('Authentication required to save generated ideas. Please sign in again.');
    }

    let failedPersistCount = 0;
    const persistedIdeas = await Promise.all(
      generatedIdeas.map(async (idea) => {
        try {
          const saved = await updateContent({
            ...idea,
            team_id: teamId,
            date: idea.date,
            time: idea.time,
            status: idea.status,
            title: idea.title,
            description: idea.description,
            hook: idea.hook,
            caption: idea.caption,
            cta: idea.cta,
            hashtags: idea.hashtags,
            platform: idea.platform
          }, userId, resolvedToken);

          if (saved?.id) {
            return {
              ...idea,
              ...saved,
              id: saved.id,
              date: idea.date,
              time: idea.time,
              status: idea.status,
              team_id: idea.team_id,
              persona_id: idea.persona_id,
              persona_name: idea.persona_name,
              platform: idea.platform,
              hook: idea.hook,
              caption: idea.caption,
              cta: idea.cta,
              hashtags: idea.hashtags
            } as ContentIdea;
          }

          failedPersistCount += 1;
          return idea;
        } catch (persistErr) {
          failedPersistCount += 1;
          console.error('Failed to persist generated idea:', persistErr);
          return idea;
        }
      })
    );

    if (failedPersistCount === generatedIdeas.length) {
      throw new Error('Ideas were generated, but none could be saved to the database. Please run migrations and try again.');
    }

    ideasToReturn = persistedIdeas;
  }

  // Update Ideas Cache with generated/persisted items
  if (userId && ideasToReturn.length > 0) {
    const cacheKey = teamId ? `${CACHE_PREFIX}IDEAS_${teamId}` : `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey) || [];
    setCache(cacheKey, [...cached, ...ideasToReturn]);
  }

  return ideasToReturn;
};

export const completeUserOnboarding = async (userId: string) => {
  // Update Supabase directly to ensure state is saved
  /* 
   * Audit Note: Using direct Supabase client here because supabaseFetch 
   * is better suited for REST endpoints, and we want to ensure the 
   * client's session state is respected for RLS if applicable.
   */
  const { error } = await supabase
    .from('profiles')
    .update({ has_completed_onboarding: true })
    .eq('id', userId);

  if (error) throw error; // CRITICAL: Throwing error to UI per Audit
}

export const createCheckoutSession = async (priceId: string, userId: string, email?: string, token?: string) => {
  if (!token) throw new Error("Token required for checkout");
  try {
    const response = await fetchWithRetry(CREATE_CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        userId,
        email
      })
    }, 1, token);

    if (!response.ok) {
      throw new Error(`Checkout failed: ${response.status}`);
    }

    const data = await response.json();
    return data; // Should contain { checkoutUrl: "..." }
  } catch (error) {
    console.error("Create checkout session failed", error);
    throw error;
  }
};
