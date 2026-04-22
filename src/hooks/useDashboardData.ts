import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { ContentIdea, IdeaStatus, PersonaData } from '../types';
import { getCachedIdeas } from '../services/genai';
import { getCachedTeamIdeas } from '../services/teams';
import { fetchUserIdeas, fetchPersonas } from '../services/genai';

export function useDashboardData() {
    const { user, session } = useAuth();
    const { currentTeam } = useTeam();

    const [ideas, setIdeas] = useState<ContentIdea[]>([]);
    const [allPersonas, setAllPersonas] = useState<PersonaData[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const requestIdRef = useRef(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'All'>('All');

    const refreshData = async () => {
        if (user) {
            const requestId = ++requestIdRef.current;
            const accessToken = session?.access_token;
            if (!accessToken) {
                // Session can arrive slightly after user; avoid clearing data with unauthenticated fetches.
                return;
            }

            // Check cache FIRST to prevent UI flicker
            let hasCache = false;

            if (currentTeam) {
                const cached = getCachedTeamIdeas(currentTeam.id);
                if (cached) hasCache = true;
            } else {
                const cached = getCachedIdeas(user.id);
                if (cached) hasCache = true;
            }

            // Only show loader if we don't have cached data
            if (!hasCache) setIsFetching(true);

            try {
                // Unified Data Fetching
                // Explicitly handling null teamId for Personal Mode
                const targetTeamId = currentTeam?.id || null;

                const [ideasResult, personasResult] = await Promise.allSettled([
                    fetchUserIdeas(user.id, targetTeamId, accessToken),
                    fetchPersonas(
                        user.id,
                        targetTeamId,
                        accessToken
                    )
                ]);

                // Ignore stale responses from previous refresh calls.
                if (requestId !== requestIdRef.current) {
                    return;
                }

                if (ideasResult.status === 'fulfilled') {
                    setIdeas(ideasResult.value);
                } else {
                    console.error('Error loading ideas', ideasResult.reason);
                }

                if (personasResult.status === 'fulfilled') {
                    setAllPersonas(personasResult.value);
                } else {
                    console.error('Error loading personas', personasResult.reason);
                }

            } catch (err) {
                console.error("Error loading dashboard data", err);
            } finally {
                // Always ensure loader is off
                if (requestId === requestIdRef.current) {
                    setIsFetching(false);
                }
            }
        }
    };

    // Reload when auth session or team context changes
    useEffect(() => {
        refreshData();
    }, [user, session?.access_token, currentTeam?.id]);

    // Derived State: Filtered Ideas
    const safeLower = (s?: string) => (s || '').toLowerCase();

    const filteredIdeas = ideas.filter(i => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || (
            safeLower(i.title).includes(query) ||
            safeLower(i.description).includes(query) ||
            safeLower(i.hook).includes(query) ||
            safeLower(i.caption).includes(query) ||
            safeLower(i.cta).includes(query) ||
            safeLower(i.hashtags).includes(query) ||
            (Array.isArray(i.platform) && i.platform.some(p => safeLower(p).includes(query)))
        );
        const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return {
        ideas,
        setIdeas,
        allPersonas,
        setAllPersonas, // Exported to allow selection logic in hook or parent
        isFetching,
        refreshData,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredIdeas
    };
}
