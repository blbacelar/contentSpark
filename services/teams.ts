import { Team, TeamMember, ContentIdea } from '../types';
import { GET_USER_IDEAS_URL, fetchWithRetry } from './genai';



// Helper to generate code
const generateCode = () => Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);

import { supabaseFetch } from './supabase';

export const createTeam = async (name: string, userId: string, token?: string | null): Promise<Team | null> => {
    try {
        if (!token) throw new Error("Authentication required for createTeam");

        // 1. Create the team
        const teamData = await supabaseFetch('teams', {
            method: 'POST',
            body: JSON.stringify({
                name,
                owner_id: userId,
                invitation_code: generateCode()
            }),
            headers: { 'Prefer': 'return=representation' } // Ask for returned data
        }, token);

        const team = teamData?.[0]; // Supabase returns array
        if (!team) return null;

        // 2. Add creator as owner
        // Note: RLS should allow this if policy is setup correctly, or we rely on 'default' team logic
        // But previously we manually inserted into team_members.
        // Let's do that via REST.
        await supabaseFetch('team_members', {
            method: 'POST',
            body: JSON.stringify({
                team_id: team.id,
                user_id: userId,
                role: 'owner'
            })
        }, token);

        return team;
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
};

export const fetchUserTeams = async (userId: string, token?: string | null): Promise<Team[]> => {
    try {
        if (!token) {
            console.warn("fetchUserTeams called without token - skipping");
            return [];
        }

        // RLS will filter by user automatically based on token
        const data = await supabaseFetch('teams?select=*', {
            method: 'GET'
        }, token);

        return data || [];
    } catch (error) {
        console.error('Error fetching teams:', error);
        return [];
    }
};

export const fetchTeamMembers = async (teamId: string, token?: string | null): Promise<TeamMember[]> => {
    try {
        if (!token) return [];

        // Join with profiles table
        // Syntax: *,user:profiles(...)
        const query = `select=*,user:profiles(first_name,last_name,avatar_url,email)&team_id=eq.${teamId}`;
        const data = await supabaseFetch(`team_members?${query}`, {
            method: 'GET'
        }, token);

        return data as any as TeamMember[];
    } catch (error) {
        console.error('Error fetching team members:', error);
        return [];
    }
};

export const joinTeam = async (teamId: string, userId: string, token?: string | null): Promise<boolean> => {
    try {
        if (!token) throw new Error("Auth required");

        // Check exists
        // Check exists
        const existing = await supabaseFetch(`team_members?team_id=eq.${teamId}&user_id=eq.${userId}&select=team_id`, { method: 'GET' }, token);
        if (existing && existing.length > 0) return true;

        await supabaseFetch('team_members', {
            method: 'POST',
            body: JSON.stringify({
                team_id: teamId,
                user_id: userId,
                role: 'member'
            })
        }, token);

        return true;
    } catch (error) {
        console.error("Error joining team:", error);
        return false;
    }
};

export const joinTeamByCode = async (code: string, userId: string, token?: string | null): Promise<{ success: boolean; team?: Team; error?: string }> => {
    try {
        if (!token) return { success: false, error: 'Authentication required' };

        // Use RPC to atomically find team and join (bypasses RLS)
        const result = await supabaseFetch('rpc/join_team_by_code', {
            method: 'POST',
            body: JSON.stringify({ code })
        }, token);

        if (result && result.success) {
            return {
                success: true,
                team: { id: result.team_id, name: result.team_name, owner_id: '', created_at: '', updated_at: '' } as Team
            };
        } else {
            return {
                success: false,
                error: result?.error || 'Failed to join team.'
            };
        }
    } catch (error: any) {
        console.error("Error joining team by code:", error);
        return { success: false, error: error.message };
    }
};

export const regenerateInviteCode = async (teamId: string, token?: string | null): Promise<string | null> => {
    try {
        if (!token) throw new Error("Auth required");
        const newCode = generateCode();

        const data = await supabaseFetch(`teams?id=eq.${teamId}`, {
            method: 'PATCH',
            body: JSON.stringify({ invitation_code: newCode }),
            headers: { 'Prefer': 'return=representation' }
        }, token);

        return data?.[0]?.invitation_code;
    } catch (error) {
        console.error("Error updating invite code:", error);
        throw error;
    }
};

export const getInviteLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/join-team/${code}`;
};

// --- Caching Helpers ---
const CACHE_PREFIX = 'CS_CACHE_TEAMS_';
const CACHE_TTL = 5 * 60 * 1000;

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

export const getCachedTeamIdeas = (teamId: string): ContentIdea[] | null => {
    return getCache<ContentIdea[]>(`${CACHE_PREFIX}IDEAS_${teamId}`);
};

const getCache = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const cached: CacheItem<T> = JSON.parse(item);
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
        const cacheItem: CacheItem<any> = { data, timestamp: Date.now() };
        localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) { console.warn("Cache write failed", e); }
};

import { fetchUserIdeas } from './genai';

export const fetchTeamIdeas = async (teamId: string, userId?: string, token?: string | null): Promise<ContentIdea[]> => {
    // Reuse central fetching logic which handles schema differences (scheduled_at vs date/time)
    // fetchUserIdeas signature: (userId: string, teamId?: string, token?: string)
    // If teamId is provided to fetchUserIdeas, it filters by team_id and ignores userId filter logic (see genai.ts)
    return fetchUserIdeas(userId || '', teamId, token || undefined);
}
