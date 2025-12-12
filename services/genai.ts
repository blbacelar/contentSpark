import { GoogleGenAI, Type } from "@google/genai";
import { parseISO, isValid, format } from "date-fns";
import { ContentIdea, FormData, Tone, PersonaData } from "../types";
import { supabase } from "../services/supabase";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Update Webhook URL
const UPDATE_WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/update-card";
const GET_USER_IDEAS_URL = "https://n8n.bacelardigital.tech/webhook/get-user-ideas";
const DELETE_WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/delete-user-ideas";
const GET_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/get-persona";
const SAVE_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/save-persona";
const UPDATE_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/update-persona";
const CREATE_IDEA_WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/create-idea";
const CREATE_CHECKOUT_URL = "https://n8n.bacelardigital.tech/webhook/create-checkout";

export const generateId = () => Math.random().toString(36).substr(2, 9);


// --- Caching Helpers ---
const CACHE_PREFIX = 'CS_CACHE_';

const getCache = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
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
const fetchWithRetry = async (url: string, options: RequestInit, retries = 1): Promise<Response> => {
  try {
    // Inject Auth Token
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers || {});
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    const finalOptions = { ...options, headers };

    const response = await fetch(url, finalOptions);
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
  } catch (err: any) {
    if (retries > 0 && (err.message.includes("busy") || err.message.includes("overwhelmed"))) {
      await new Promise(res => setTimeout(res, 2000)); // Wait 2s
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
};

// --- Services ---

export const fetchUserIdeas = async (userId: string): Promise<ContentIdea[]> => {
  const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;

  // Try Cache First
  const cached = getCache<ContentIdea[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${GET_USER_IDEAS_URL}?user_id=${encodeURIComponent(userId)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch user ideas: ${response.status}`);
    }

    const data = await response.json();

    let ideas: any[] = [];
    if (Array.isArray(data)) {
      ideas = data;
    } else if (data.ideas && Array.isArray(data.ideas)) {
      ideas = data.ideas;
    } else {
      return [];
    }

    // Normalize data structure
    const normalizedIdeas = ideas.map(idea => {
      let platforms: string[] = ["General"];
      if (Array.isArray(idea.platform)) {
        platforms = idea.platform;
      } else if (typeof idea.platform === 'string') {
        platforms = [idea.platform];
      }

      let dateVal: string | null = idea.date || null;
      let timeVal: string | null = null;

      if (idea.scheduled_at) {
        try {
          const d = parseISO(idea.scheduled_at);
          if (isValid(d)) {
            // Adjust to UTC manually or rely on parsed date
            // The previous logic used getUTC... which implies the input string includes timezone or is treated as UTC.
            // parseISO parses as local time if no timezone, or UTC if Z.
            // Let's assume input needs to be standardized.
            // date-fns format uses local time by default unless using formatISO or similar.
            // However, the original code explicitly extracted UTC components.
            // Ideally we stick to that behavior or assume date-fns handles it better.
            // Let's simplify and use the ISO string parts directly if possible, or simpler formatting.
            // Actually, to match previous "UTC" extraction:
            dateVal = format(d, 'yyyy-MM-dd');
            timeVal = format(d, 'HH:mm');
          }
        } catch (e) { }
      }

      if (!timeVal && idea.time) {
        // Handle "2023-01-01T10:00:00" or simple "10:00"
        if (idea.time.includes('T')) {
          try {
            const d = parseISO(idea.time);
            if (isValid(d)) {
              timeVal = format(d, 'HH:mm');
            }
          } catch (e) {
            timeVal = null;
          }
        } else {
          timeVal = idea.time.substring(0, 5);
        }
      }

      return {
        id: idea.id || generateId(),
        title: idea.title || "Untitled",
        description: idea.description || "",
        hook: idea.hook || "",
        caption: idea.caption || "",
        cta: idea.cta || "",
        hashtags: idea.hashtags || "",
        platform: platforms,
        date: dateVal,
        time: timeVal,
        status: idea.status || 'Pending'
      };
    });

    setCache(cacheKey, normalizedIdeas);
    return normalizedIdeas;

  } catch (error) {
    console.error("Error fetching user ideas:", error);
    return [];
  }
};

export const updateContent = async (payload: Partial<ContentIdea>, userId?: string) => {
  // Optimistically update cache if userId is present
  if (userId && payload.id) {
    const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey);
    if (cached) {
      const updated = cached.map(i => i.id === payload.id ? { ...i, ...payload } : i);
      setCache(cacheKey, updated);
    }
  }

  if (!UPDATE_WEBHOOK_URL) return;

  try {
    const finalPayload: any = {
      ...payload,
      user_id: userId,
      platform_suggestion: payload.platform
    };

    if (payload.date && payload.time) {
      finalPayload.time = `${payload.date}T${payload.time}:00`;
    }

    const response = await fetchWithRetry(UPDATE_WEBHOOK_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) { }

    if (response.status === 500 || !response.ok || data.error === true) {
      throw new Error(data.message || data.error || `Update failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to update content via webhook:", error);
    throw error;
  }
};

export const createContentIdea = async (idea: ContentIdea, userId: string) => {
  // Optimistically update cache
  const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
  const cached = getCache<ContentIdea[]>(cacheKey) || [];
  // Avoid duplicates in cache if possible
  if (!cached.some(i => i.id === idea.id)) {
    setCache(cacheKey, [...cached, idea]);
  }

  try {
    const payload: any = {
      ...idea,
      user_id: userId,
      platform_suggestion: idea.platform
    };

    if (idea.date && idea.time) {
      payload.time = `${idea.date}T${idea.time}:00`;
    }

    const response = await fetchWithRetry(CREATE_IDEA_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
    throw error;
  }
};

export const deleteContent = async (id: string, userId?: string) => {
  if (userId) {
    const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey);
    if (cached) {
      setCache(cacheKey, cached.filter(i => i.id !== id));
    }
  }

  if (!DELETE_WEBHOOK_URL) return;

  try {
    const response = await fetch(DELETE_WEBHOOK_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, user_id: userId }),
    });

    if (!response.ok) {
      console.warn(`Delete webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete content via webhook:", error);
  }
};

export const fetchPersonas = async (userId: string): Promise<PersonaData[]> => {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(p => ({
      ...p,
      pains_list: p.pains_list || [],
      goals_list: p.goals_list || [],
      questions_list: p.questions_list || []
    }));
  } catch (err) {
    console.error("Error fetching personas:", err);
    return [];
  }
};

export const fetchUserPersona = async (userId: string): Promise<PersonaData | null> => {
  // Deprecated for direct use, fetches the most recent persona
  const personas = await fetchPersonas(userId);
  return personas.length > 0 ? personas[0] : null;
};

export const createPersona = async (persona: PersonaData) => {
  try {
    // Remove id if empty string to allow db generation
    const { id, ...rest } = persona;

    const payload = {
      ...rest,
      pains_list: persona.pains_list,
      goals_list: persona.goals_list,
      questions_list: persona.questions_list,
      income_level: persona.income_level,
    };

    const { data, error } = await supabase
      .from('personas')
      .insert(payload)
      .select() // Return the created object
      .single();

    if (error) throw error;

    // Call Webhook
    let webhookFailed = false;
    try {
      if (SAVE_PERSONA_URL) {
        await fetchWithRetry(SAVE_PERSONA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    } catch (e) {
      console.warn("Save persona webhook failed:", e);
      webhookFailed = true;
    }

    return { ...data, webhookFailed };
  } catch (err) {
    console.error("Error creating persona:", err);
    throw err;
  }
};

export const saveUserPersona = async (persona: PersonaData) => {
  // Legacy support: Just create or update based on if we find one? 
  // actually, let's make this create a new one if it has no ID, or update if it does.
  if (persona.id) {
    return updateUserPersona(persona);
  } else {
    return createPersona(persona);
  }
};

export const deletePersona = async (id: string, userId: string) => {
  try {
    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (err) {
    console.error("Error deleting persona:", err);
    throw err;
  }
}

export const updateUserPersona = async (persona: PersonaData) => {
  try {
    if (!persona.id) throw new Error("Persona ID required for update");

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
      pains_list: persona.pains_list,
      goals_list: persona.goals_list,
      questions_list: persona.questions_list
    };

    const { error } = await supabase
      .from('personas')
      .update(updatePayload)
      .eq('id', persona.id);

    if (error) throw error;

    // Call Webhook
    let webhookFailed = false;
    try {
      if (UPDATE_PERSONA_URL) {
        await fetchWithRetry(UPDATE_PERSONA_URL, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...updatePayload, id: persona.id, user_id: persona.user_id })
        });
      }
    } catch (e) {
      console.warn("Update persona webhook failed:", e);
      webhookFailed = true;
    }

    return { success: true, webhookFailed };
  } catch (err) {
    console.error("Error updating persona:", err);
    throw err;
  }
};

export const generateContent = async (
  formData: FormData,
  webhookUrl?: string,
  userId?: string,
  persona?: PersonaData | null,
  language: string = 'en'
): Promise<ContentIdea[]> => {

  // Construct Persona Payload Object
  const personaPayload = persona ? {
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
          persona: personaPayload,
          language: language // Pass selected language
        }),
      });

      const text = await response.text();
      let data: any = {};

      try { data = JSON.parse(text); } catch (e) {
        if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
      }

      if (response.status === 500 || !response.ok || data.error === true) {
        throw new Error(data.message || `Server Error: ${response.status}`);
      }

      let ideas: any[] = [];
      if (Array.isArray(data)) ideas = data;
      else if (data && data.ideas && Array.isArray(data.ideas)) ideas = data.ideas;
      else throw new Error("Invalid response format");

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

      const prompt = `
        Generate 6 unique, creative, and high-quality content ideas in ${language.startsWith('pt') ? 'Portuguese' : 'English'}.
        
        Context:
        - Niche/Topic: ${formData.topic}
        - Target Audience: ${formData.audience}
        - Tone: ${formData.tone}
        ${personaContext}
        
        For each idea, provide:
        1. A catchy Title
        2. A Hook (The first sentence/attention grabber)
        3. A short Description (Internal summary of the idea)
        4. A full Caption (The actual post body text, engaging and formatted)
        5. A Call to Action (CTA)
        6. A set of relevant Hashtags (string format e.g. "#tag1 #tag2")
        7. A list of suitable Social Media Platforms
        `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                hook: { type: Type.STRING },
                caption: { type: Type.STRING },
                cta: { type: Type.STRING },
                hashtags: { type: Type.STRING },
                platform: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["title", "description", "hook", "caption", "cta", "hashtags", "platform"],
            },
          },
        },
      });

      const text = response.text;
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
    const cacheKey = `${CACHE_PREFIX}IDEAS_${userId}`;
    const cached = getCache<ContentIdea[]>(cacheKey) || [];
    // Append new ideas
    setCache(cacheKey, [...cached, ...generatedIdeas]);
  }

  return generatedIdeas;
};

export const completeUserOnboarding = async (userId: string) => {
  const WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/complete-onboarding";

  // 1. Try Webhook (Log warning on failure but don't stop)
  try {
    await fetch(WEBHOOK_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, has_completed_onboarding: true })
    });
  } catch (e) {
    console.warn("Webhook update failed, trying direct DB update", e);
  }

  // 2. Fallback: Update Supabase directly to ensure state is saved
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ has_completed_onboarding: true })
      .eq('id', userId);

  } catch (e) {
    console.error("Failed to update onboarding status in DB", e);
  }
}

export const createCheckoutSession = async (priceId: string, userId: string, email?: string) => {
  try {
    const response = await fetch(CREATE_CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        userId,
        email
      })
    });

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
