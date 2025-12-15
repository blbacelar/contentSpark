import { supabase } from './supabase';
import { Team, TeamMember, ContentIdea } from '../types';
import { GET_USER_IDEAS_URL, fetchWithRetry } from './genai';

export const createTeam = async (name: string, userId: string): Promise<Team | null> => {
    try {
        // 1. Create the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert({ name, owner_id: userId })
            .select()
            .single();

        if (teamError) throw teamError;
        if (!team) return null;

        // 2. Add creator as owner in team_members
        const { error: memberError } = await supabase
            .from('team_members')
            .insert({
                team_id: team.id,
                user_id: userId,
                role: 'owner'
            });

        if (memberError) {
            // Rollback? ideally yes, but for now just log
            console.error("Error adding owner to team:", memberError);
        }

        return team;
        return team;
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
};

export const fetchUserTeams = async (userId: string): Promise<Team[]> => {
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('*');
        // The RLS policy "Users can view teams they are members of" handles the filtering!

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching teams:', error);
        return [];
    }
};

export const fetchTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
    try {
        // Need to join with profiles or auth.users to get names? 
        // Supabase auth.users is not directly joinable usually unless we have a public users/profiles table.
        // We have 'profiles' table.
        const { data, error } = await supabase
            .from('team_members')
            .select(`
        *,
        user:profiles(first_name, last_name, avatar_url)
      `)
            .eq('team_id', teamId);

        if (error) throw error;

        // Map data to flattened structure if needed, or keep as is.
        // The type expects user object.
        return data as any as TeamMember[];
    } catch (error) {
        console.error('Error fetching team members:', error);
        return [];
    }
};

export const joinTeam = async (teamId: string, userId: string): Promise<boolean> => {
    // This is for adding a member. For now, we assume open join or admin add.
    // Let's implement "Add Member" logic.
    try {
        const { error } = await supabase
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: userId,
                role: 'member'
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error joining team:", error);
        return false;
    }
}

// --- Caching Helpers (Duplicated from genai.ts for now, ideally shared) ---
const CACHE_PREFIX = 'CS_CACHE_TEAMS_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

// Export a safe helper to check cache
export const getCachedTeamIdeas = (teamId: string): ContentIdea[] | null => {
    return getCache<ContentIdea[]>(`${CACHE_PREFIX}IDEAS_${teamId}`);
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

export const fetchTeamIdeas = async (teamId: string, userId?: string): Promise<ContentIdea[]> => {
    const cacheKey = `${CACHE_PREFIX}IDEAS_${teamId}`;

    // Try Cache First
    const cached = getCache<ContentIdea[]>(cacheKey);
    if (cached) return cached;

    try {
        let url = `${GET_USER_IDEAS_URL}?team_id=${encodeURIComponent(teamId)}`;
        if (userId) {
            url += `&user_id=${encodeURIComponent(userId)}`;
        }
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch team ideas: ${response.status}`);
        }

        const data = await response.json();

        let ideas: any[] = [];
        if (Array.isArray(data)) {
            ideas = data;
        } else if (data.ideas && Array.isArray(data.ideas)) {
            ideas = data.ideas;
        }

        // Normalize
        const normalized = ideas.map((idea: any) => ({
            ...idea,
            platform: Array.isArray(idea.platform) ? idea.platform : [idea.platform || 'General']
        }));

        setCache(cacheKey, normalized);
        return normalized;
    } catch (error) {
        console.error("Error fetching team ideas:", error);
        return [];
    }
}
