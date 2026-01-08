import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { parseISO, isValid, format } from "date-fns";
import { ContentIdea, FormData, Tone, PersonaData, BrandingSettings } from "../types";
import { supabase } from "../services/supabase";

// Initialize Gemini Client
// Initialize Gemini Client
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Update Webhook URL
const UPDATE_WEBHOOK_URL = import.meta.env.VITE_UPDATE_WEBHOOK_URL;
export const GET_USER_IDEAS_URL = import.meta.env.VITE_GET_USER_IDEAS_URL;
const DELETE_WEBHOOK_URL = import.meta.env.VITE_DELETE_WEBHOOK_URL;
const GET_PERSONA_URL = import.meta.env.VITE_GET_PERSONA_URL;
const SAVE_PERSONA_URL = import.meta.env.VITE_SAVE_PERSONA_URL;
const UPDATE_PERSONA_URL = import.meta.env.VITE_UPDATE_PERSONA_URL;
const CREATE_IDEA_WEBHOOK_URL = import.meta.env.VITE_CREATE_IDEA_WEBHOOK_URL;
const CREATE_CHECKOUT_URL = import.meta.env.VITE_CREATE_CHECKOUT_URL;

export const generateId = () => Math.random().toString(36).substr(2, 9);

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
  if (!ai) throw new Error("AI not initialized");

  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  const filePart = await fileToGenerativePart(file);

  const prompt = `
    Analyze this Brand Kit PDF. 
    Extract the following information into a strictly valid JSON format:
    1. "colors": An array of hex color codes (e.g., ["#FFFFFF", "#000000"]). Extract at least the primary and secondary colors.
    2. "fonts": An object mapping roles to font family names. CRITICAL: Identify at least one font.
       - Roles: "title", "subtitle", "heading", "body", "quote".
       - If only one font is found, assign it to "title" AND "body".
    3. "style": A short descriptive string summarising the visual style (e.g., "Minimalist and clean", "Bold and energetic").

    Return ONLY the JSON. No markdown formatting.
    Example structure:
    {
      "colors": ["#FF0000", "#00FF00"],
      "fonts": { "title": "Roboto", "heading": "Roboto", "body": "Open Sans" },
      "style": "Modern"
    }
  `;

  try {
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const text = response.text();

    // Clean markdown if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);

    const fonts = data.fonts || {};
    // Fallback: If 'title' is missing but we have other fonts, use the first available one
    if (!fonts['title'] && Object.keys(fonts).length > 0) {
      fonts['title'] = Object.values(fonts)[0] as string;
    }
    // Ensure 'body' has a fallback properly too
    if (!fonts['body'] && fonts['title']) {
      fonts['body'] = fonts['title'];
    }

    return {
      colors: Array.isArray(data.colors) ? data.colors : [],
      fonts: fonts,
      style: data.style || "Professional"
    };
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
      console.log("DEBUG: Executing fetch...");
      const response = await fetch(url, finalOptions);
      console.log("DEBUG: Fetch returned", response.status);
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
  const cacheKey = teamId ? `${CACHE_PREFIX}IDEAS_${teamId}` : `${CACHE_PREFIX}IDEAS_${userId}`;

  // Try Cache First
  const cached = getCache<ContentIdea[]>(cacheKey);
  if (cached) return cached;

  try {
    if (!token) {
      console.warn("fetchUserIdeas called without token");
      return [];
    }

    // Direct Supabase Call
    let query = `content_ideas?select=id,title,description,hook,caption,cta,hashtags,platform_suggestion,scheduled_at,status,created_at,team_id,user_id&order=created_at.desc`;
    if (teamId) {
      query += `&team_id=eq.${teamId}`;
    } else {
      query += `&user_id=eq.${userId}`;
      // If getting user ideas, maybe filter out team ideas?
      // Current logic implies "Personal" ideas have team_id IS NULL usually.
      // But let's stick to simple "user_id" filter for now unless "Personal Team" concept is strict.
      // Actually, previous webhook logic was: 
      // if team_id provided -> filter by team_id
      // if no team_id -> filter by user_id (which might include team ideas if not careful, but usually we filter properly)
    }

    const data = await supabaseFetch(query, { method: 'GET' }, token);
    const ideas: any[] = data || [];

    // Normalize data structure
    const normalizedIdeas = ideas.map((idea: any) => {
      // Platform normalization (stored as text array or similar in postgres)
      // Supabase returns Postgres arrays as JS arrays.
      // CSV showed column is 'platform_suggestion'.
      // Platform normalization logic
      let platforms: string[] = ["General"];

      const rawPlatform = idea.platform_suggestion || idea.platform;

      if (Array.isArray(rawPlatform)) {
        platforms = rawPlatform;
      } else if (typeof rawPlatform === 'string') {
        // Try parsing if it looks like JSON array
        if (rawPlatform.trim().startsWith('[') && rawPlatform.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(rawPlatform);
            if (Array.isArray(parsed)) platforms = parsed;
            else platforms = [rawPlatform];
          } catch (e) {
            platforms = [rawPlatform];
          }
        } else {
          // Comma separated? or just single value
          // If it contains comma but not brackets, maybe CSV?
          if (rawPlatform.includes(',') && !rawPlatform.includes('[')) {
            platforms = rawPlatform.split(',').map((s: string) => s.trim());
          } else {
            platforms = [rawPlatform];
          }
        }
      }

      // Parse scheduled_at for date/time
      let date = idea.date || null;
      let time = idea.time || null;

      if (idea.scheduled_at) {
        try {
          // scheduled_at is ISO string e.g. 2025-12-10T02:00:00+00
          // STRATEGY: Treat time as Floating/Local by stripping timezone info.
          // This ensures that if DB says "22:00:00...", we show "22:00" (10pm), not converted to 3pm.
          const rawIso = idea.scheduled_at;
          // Take only the YYYY-MM-DDTHH:mm:ss part (first 19 chars), ignoring Z, +00, -07, etc.
          const floatingIso = rawIso.substring(0, 19);

          date = format(parseISO(floatingIso), 'yyyy-MM-dd');
          time = format(parseISO(floatingIso), 'HH:mm');
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

    setCache(cacheKey, normalizedIdeas);
    return normalizedIdeas;

  } catch (error) {
    console.error("Error fetching user ideas via Supabase:", error);
    return [];
  }
};

export const updateContent = async (payload: Partial<ContentIdea>, userId?: string, token?: string) => {
  let previousCache: ContentIdea[] | null = null;
  const cacheKey = userId ? `${CACHE_PREFIX}IDEAS_${userId}` : "";

  // Optimistically update cache if userId is present
  if (userId && payload.id) {
    previousCache = getCache<ContentIdea[]>(cacheKey);
    if (previousCache) {
      const updated = previousCache.map(i => i.id === payload.id ? { ...i, ...payload } : i);
      setCache(cacheKey, updated);
    }
  }

  try {
    if (!token) {
      // We might want to throw or just log warning? 
      // For drag/drop, if no token, we can't save to DB.
      throw new Error("Auth required for updateContent");
    }

    const updatePayload: any = {
      ...payload
    };

    // Handle Date/Time merger for DB (scheduled_at)
    if (payload.date) {
      // If we have a time, combine them. Default to 09:00 if no time.
      const timePart = payload.time || '09:00';
      // Construct ISO timestamp for scheduled_at (Implicit UTC/Floating)
      updatePayload.scheduled_at = `${payload.date}T${timePart}:00`;
    }

    // Remove fields that shouldn't be updated or are flattened/invalid for DB
    delete updatePayload.id;
    delete updatePayload.user_id;
    delete updatePayload.date;
    delete updatePayload.time; // DB column is scheduled_at
    delete updatePayload.persona_name; // Computed/joined field

    // Ensure platform is an array and map to correct DB column
    if (updatePayload.platform) {
      if (!Array.isArray(updatePayload.platform)) {
        updatePayload.platform = [updatePayload.platform];
      }
      updatePayload.platform_suggestion = updatePayload.platform;
      delete updatePayload.platform; // DB column is platform_suggestion
    }

    // PATCH /rest/v1/content_ideas?id=eq.{payload.id}
    await supabaseFetch(`content_ideas?id=eq.${payload.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
      headers: { 'Prefer': 'return=representation' } // to confirm update
    }, token);

  } catch (error) {
    console.error("Failed to update content via Supabase:", error);
    // Rollback cache
    if (userId && previousCache) {
      setCache(`${CACHE_PREFIX}IDEAS_${userId}`, previousCache);
    }
    throw error;
  }
};

export const createContentIdea = async (idea: ContentIdea, userId: string, token: string) => {
  // Optimistically update cache
  const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
  const cached = getCache<ContentIdea[]>(cacheKey) || [];

  // Save specific ID added for rollback
  const optimisticId = idea.id;

  // Avoid duplicates in cache if possible
  if (!cached.some(i => i.id === optimisticId)) {
    setCache(cacheKey, [...cached, idea]);
  }

  try {
    const payload: any = {
      ...idea,
      user_id: userId,
      team_id: idea.team_id,
      platform_suggestion: idea.platform
    };

    if (idea.date && idea.time) {
      payload.time = `${idea.date}T${idea.time}:00`;
    }

    const response = await fetchWithRetry(CREATE_IDEA_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 1, token);

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) { }

    if (response.status === 500 || !response.ok || data.error === true) {
      // Handle n8n specific error message "Unused Respond to Webhook..."
      const msg = data.message || (typeof data.error === 'string' ? data.error : '');
      if (msg.includes("Unused Respond to Webhook node")) {
        // This is a configuration error on n8n side but operation likely finished.
        // We can treat it as a warning and return success.
        console.warn("Webhook warning:", msg);
        return { success: true, warning: "Webhook response missing" };
      }

      throw new Error(msg || `Create failed: ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error("Failed to create content via webhook:", error);

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
    if (!token) throw new Error("Auth required for delete");

    await supabaseFetch(`content_ideas?id=eq.${id}`, {
      method: 'DELETE'
    }, token);

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
      console.warn("fetchPersonas called without token");
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

export const fetchUserPersona = async (userId: string): Promise<PersonaData | null> => {
  // Deprecated for direct use, fetches the most recent persona
  const personas = await fetchPersonas(userId);
  return personas.length > 0 ? personas[0] : null;
};

export const createPersona = async (persona: PersonaData, userId?: string, token?: string) => {
  try {
    if (!token) throw new Error("Auth required for createPersona");

    // POST /rest/v1/personas
    const payload = {
      ...persona,
      user_id: userId || persona.user_id,
      team_id: persona.team_id, // Include Team ID
      // Clean up lists to ensure they are arrays
      pains_list: persona.pains_list || [],
      goals_list: persona.goals_list || [],
      questions_list: persona.questions_list || [],
      description: persona.description || ''
    };
    delete payload.id; // Ensure no ID is sent for creation

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
  formData: FormData,
  webhookUrl?: string,
  userId?: string,
  persona?: PersonaData | null,
  language: string = 'en',
  teamId?: string,
  token?: string,
  branding?: BrandingSettings
): Promise<ContentIdea[]> => {

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

  // If a webhook URL is provided, prioritize it
  if (webhookUrl && webhookUrl.trim() !== "") {
    try {
      const response = await fetchWithRetry(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user_id: userId,
          team_id: teamId, // Add team_id
          persona: personaPayload,
          language: language,
          branding: branding || {}
        }),
      }, 0, token);

      const text = await response.text();
      let data: any = {};

      try { data = JSON.parse(text); } catch (e) {
        if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
      }

      if (response.status === 500 || !response.ok || data.error === true) {
        const errorMessage = data.message || data.error?.message || data.error || `Server Error: ${response.status}`;
        throw new Error(errorMessage);
      }

      let ideas: any[] = [];
      if (Array.isArray(data)) ideas = data;
      else if (data && data.ideas && Array.isArray(data.ideas)) ideas = data.ideas;
      else throw new Error(`Invalid response format. Received: ${text.substring(0, 100)}...`);

      generatedIdeas = ideas.map(idea => {
        let platforms: string[] = ["General"];
        if (Array.isArray(idea.platform)) platforms = idea.platform;
        else if (typeof idea.platform === 'string') platforms = [idea.platform];

        return {
          id: idea.id || generateId(),
          title: idea.title || "Untitled",
          description: idea.description || "",
          hook: idea.hook || "",
          caption: idea.caption || "",
          cta: idea.cta || "",
          hashtags: idea.hashtags || "",
          canva_prompt: idea.canva_prompt || "",
          platform: platforms,
          date: null,
          time: null,
          status: 'Pending',
          persona_id: persona?.id,
          persona_name: persona?.name
        };
      });

    } catch (error) {
      console.warn("Webhook generation failed:", error);
      throw error;
    }
  } else {
    // Gemini API Implementation
    try {
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

      const prompt = `
        Generate 6 unique, creative, and high-quality content ideas in ${language.startsWith('pt') ? 'Portuguese' : 'English'}.
        
        Context:
        - Niche/Topic: ${safeTopic}
        - Target Audience: ${safeAudience}
        - Tone: ${safeTone}
        - Tone: ${safeTone}
        ${personaContext}

        Branding Context:
        ${branding ? `
        - Style: ${branding.style}
        - Brand Colors: ${branding.colors.join(', ')}
        ` : 'N/A'}
        
        For each idea, provide:
        1. A catchy Title
        2. A Hook (The first sentence/attention grabber)
        3. A short Description (Internal summary of the idea)
        4. A full Caption (The actual post body text, engaging and formatted)
        5. A Call to Action (CTA)
        6. A set of relevant Hashtags (string format e.g. "#tag1 #tag2")
        7. A list of suitable Social Media Platforms
        `;

      if (!ai) {
        throw new Error("Gemini API configuration is missing. Please check your environment variables.");
      }

      const model = ai.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                hook: { type: SchemaType.STRING },
                caption: { type: SchemaType.STRING },
                cta: { type: SchemaType.STRING },
                hashtags: { type: SchemaType.STRING },
                canva_prompt: { type: SchemaType.STRING },
                platform: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ["title", "description", "hook", "caption", "cta", "hashtags", "canva_prompt", "platform"],
            },
          },
        }
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) return [];

      const rawIdeas = JSON.parse(text) as Omit<ContentIdea, 'id' | 'date' | 'status'>[];
      generatedIdeas = rawIdeas.map(idea => ({
        ...idea,
        id: generateId(),
        date: null,
        time: null,
        status: 'Pending',
        persona_id: persona?.id,
        persona_name: persona?.name
      }));

    } catch (error) {
      console.error("Gemini generation failed:", error);
      throw new Error("Failed to generate content via AI Strategy Team.");
    }
  }

  // Update Ideas Cache with new generated items
  if (userId && generatedIdeas.length > 0) {
    const cacheKey = teamId ? `${CACHE_PREFIX}IDEAS_${teamId}` : `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey) || [];
    // Append new ideas
    setCache(cacheKey, [...cached, ...generatedIdeas]);
  }

  return generatedIdeas;
};

export const completeUserOnboarding = async (userId: string, token: string) => {
  const WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/complete-onboarding";

  // 1. Try Webhook
  try {
    await fetchWithRetry(WEBHOOK_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, has_completed_onboarding: true })
    }, 1, token);
  } catch (e) {
    console.warn("Webhook update failed, trying direct DB update", e);
  }

  // 2. Fallback: Update Supabase directly to ensure state is saved
  /* 
   * Audit Note: Using direct Supabase client here because supabaseFetch 
   * is better suited for REST endpoints, and we want to ensure the 
   * client's session state is respected for RLS if applicable.
   */
  const { error } = await supabase
    .from('profiles')
    .update({ has_completed_onboarding: true })
    .eq('id', userId);

  if (error) throw error;
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
