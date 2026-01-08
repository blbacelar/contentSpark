
import { useState, useEffect } from 'react';
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

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'All'>('All');

    const refreshData = async () => {
        if (user) {
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
                let ideasData: ContentIdea[] = [];
                let personasList: PersonaData[] = [];

                if (currentTeam) {
                    // Fetch Team Data
                    ideasData = await fetchUserIdeas(user.id, currentTeam.id, session?.access_token);
                    personasList = await fetchPersonas(
                        user.id,
                        currentTeam?.id || null, // Safety check matches audit
                        session?.access_token
                    );
                } else {
                    // Fetch Personal Data (Legacy/Default)
                    [ideasData, personasList] = await Promise.all([
                        fetchUserIdeas(user.id, undefined, session?.access_token),
                        fetchPersonas(user.id, null, session?.access_token)
                    ]);
                }

                setIdeas(ideasData);
                setAllPersonas(personasList);

            } catch (err) {
                console.error(err);
            } finally {
                // Always ensure loader is off
                setIsFetching(false);
            }
        }
    };

    // Reload when Team Changes
    useEffect(() => {
        refreshData();
    }, [user, currentTeam]);

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
