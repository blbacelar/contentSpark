import { GoogleGenAI, Type } from "@google/genai";
import { ContentIdea, FormData, Tone, PersonaData } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Update Webhook URL
const UPDATE_WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/update-card";
const GET_USER_IDEAS_URL = "https://n8n.bacelardigital.tech/webhook/get-user-ideas";
const DELETE_WEBHOOK_URL = "https://n8n.bacelardigital.tech/webhook/delete-user-ideas";
const GET_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/get-persona";
const SAVE_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/save-persona";
const UPDATE_PERSONA_URL = "https://n8n.bacelardigital.tech/webhook/update-persona";

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
                const d = new Date(idea.scheduled_at);
                if (!isNaN(d.getTime())) {
                    const year = d.getUTCFullYear();
                    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                    const day = d.getUTCDate().toString().padStart(2, '0');
                    dateVal = `${year}-${month}-${day}`;

                    const hours = d.getUTCHours().toString().padStart(2, '0');
                    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                    timeVal = `${hours}:${minutes}`;
                }
            } catch (e) {}
        }

        if (!timeVal && idea.time) {
             if (idea.time.includes('T')) {
                 try {
                    const d = new Date(idea.time);
                    if (!isNaN(d.getTime())) {
                        const hours = d.getUTCHours().toString().padStart(2, '0');
                        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                        timeVal = `${hours}:${minutes}`;
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

    const response = await fetch(UPDATE_WEBHOOK_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) {}

    if (response.status === 500 || !response.ok || data.error === true) {
        throw new Error(data.message || data.error || `Update failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to update content via webhook:", error);
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

export const fetchUserPersona = async (userId: string): Promise<PersonaData | null> => {
  const cacheKey = `${CACHE_PREFIX}PERSONA_${userId}`;
  const cached = getCache<PersonaData>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${GET_PERSONA_URL}?user_id=${encodeURIComponent(userId)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
       console.warn(`Failed to fetch persona: ${response.status}`);
       return null;
    }
    
    const text = await response.text();
    if (!text) return null;
    
    try {
        const data = JSON.parse(text);
        if (Object.keys(data).length === 0) return null;
        
        // Ensure arrays are arrays
        const safeData: PersonaData = {
            ...data,
            pains_list: Array.isArray(data.pains_list) ? data.pains_list : [],
            goals_list: Array.isArray(data.goals_list) ? data.goals_list : [],
            questions_list: Array.isArray(data.questions_list) ? data.questions_list : [],
        };

        setCache(cacheKey, safeData);
        return safeData;
    } catch (e) {
        return null;
    }
  } catch (error) {
    console.error("Error fetching persona:", error);
    return null;
  }
};

export const saveUserPersona = async (persona: PersonaData) => {
  // Update Cache Immediately
  if (persona.user_id) {
     const cacheKey = `${CACHE_PREFIX}PERSONA_${persona.user_id}`;
     setCache(cacheKey, persona);
  }

  try {
    const response = await fetch(SAVE_PERSONA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persona),
    });

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) {}

    if (response.status === 500 || !response.ok || data.error === true) {
         throw new Error(data.message || (typeof data.error === 'string' ? data.error : `Failed to save persona`));
    }
    return data;
  } catch (error) {
    console.error("Error saving persona:", error);
    throw error;
  }
};

export const updateUserPersona = async (persona: PersonaData) => {
   // Update Cache Immediately
  if (persona.user_id) {
     const cacheKey = `${CACHE_PREFIX}PERSONA_${persona.user_id}`;
     setCache(cacheKey, persona);
  }

  try {
    const response = await fetch(UPDATE_PERSONA_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persona),
    });

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) {}

    if (response.status === 500 || !response.ok || data.error === true) {
         throw new Error(data.message || (typeof data.error === 'string' ? data.error : `Failed to update persona`));
    }
    return data;
  } catch (error) {
    console.error("Error updating persona:", error);
    throw error;
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
      const response = await fetch(webhookUrl, {
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
          status: 'Pending'
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
        status: 'Pending'
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