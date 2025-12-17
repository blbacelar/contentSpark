import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Team } from '../types';
import { fetchUserTeams, createTeam as createTeamService, regenerateInviteCode } from '../services/teams';
import { useAuth } from './AuthContext';

interface TeamContextType {
    teams: Team[];
    currentTeam: Team | null;
    isLoading: boolean;
    error: string | null;
    createTeam: (name: string) => Promise<void>;
    switchTeam: (teamOrId: string | Team | null) => void;
    refreshTeams: () => Promise<void>;
    updateTeamCode: (teamId: string) => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
    const { user, session } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const creatingDefaultRef = useRef(false);
    const isInitialized = useRef(false);

    // Load teams when user adds
    const loadTeams = async () => {
        if (!user || !session?.access_token) {
            setTeams([]);
            setCurrentTeam(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const token = session.access_token;
            let data = await fetchUserTeams(user.id, token);

            // Auto-create default team if none exists
            if (data.length === 0 && !creatingDefaultRef.current) {
                creatingDefaultRef.current = true;
                try {
                    console.log("No teams found, creating default team...");
                    // Ideally use profile name, but might not be loaded yet inside this context easily unless passed
                    // We'll use a generic name or try to get it from metadata
                    const defaultName = "Personal Team";
                    const newTeam = await createTeamService(defaultName, user.id, token);
                    if (newTeam) {
                        data = [newTeam];
                    }
                } finally {
                    creatingDefaultRef.current = false;
                }
            }

            setTeams(data);
            console.log("DEBUG: loadTeams data:", data, "LastID:", localStorage.getItem('CS_LAST_TEAM_ID'));

            // Auto-select last used team or first team if not initialized
            if (!isInitialized.current && !currentTeam && data.length > 0) {
                const lastTeamId = localStorage.getItem('CS_LAST_TEAM_ID');
                const targetTeam = lastTeamId ? data.find(t => t.id === lastTeamId) : data[0];
                console.log("DEBUG: Auto-selecting team:", targetTeam);
                setCurrentTeam(targetTeam || data[0]);
            }
            isInitialized.current = true;

        } catch (err: any) {
            console.error("Failed to load teams", err);
            setError(err.message || "Failed to load teams");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (session?.access_token) {
            loadTeams();
        }
    }, [user, session]);

    // Persist selection
    useEffect(() => {
        if (currentTeam?.id) {
            localStorage.setItem('CS_LAST_TEAM_ID', currentTeam.id);
        }
    }, [currentTeam]);

    const createTeam = async (name: string) => {
        if (!user || !session?.access_token) return;
        // Let error bubble up to component
        try {
            const newTeam = await createTeamService(name, user.id, session.access_token);
            if (newTeam) {
                await loadTeams();
                setCurrentTeam(newTeam);
            }
        } catch (err: any) {
            setError(err.message || "Failed to create team");
            throw err;
        }
    };

    const switchTeam = (teamOrId: string | Team | null) => {
        if (teamOrId === null) {
            setCurrentTeam(null);
        } else if (typeof teamOrId === 'string') {
            const team = teams.find(t => t.id === teamOrId);
            if (team) setCurrentTeam(team);
        } else {
            // It's a Team object
            setCurrentTeam(teamOrId);
        }
    };

    const updateTeamCode = async (teamId: string) => {
        try {
            if (!session?.access_token) return;
            const newCode = await regenerateInviteCode(teamId, session.access_token);
            if (newCode) {
                // Update local state
                setTeams(prev => prev.map(t => t.id === teamId ? { ...t, invitation_code: newCode } : t));
                if (currentTeam?.id === teamId) {
                    setCurrentTeam(prev => prev ? { ...prev, invitation_code: newCode } : null);
                }
            }
        } catch (err: any) {
            console.error("Failed to regenerate code", err);
            throw err;
        }
    };

    const value = React.useMemo(() => ({
        teams,
        currentTeam,
        isLoading,
        error,
        createTeam,
        switchTeam,
        refreshTeams: loadTeams,
        updateTeamCode
    }), [teams, currentTeam, isLoading, error]);

    return (
        <TeamContext.Provider value={value}>
            {children}
        </TeamContext.Provider>
    );
};

export const useTeam = () => {
    const context = useContext(TeamContext);
    if (context === undefined) {
        throw new Error('useTeam must be used within a TeamProvider');
    }
    return context;
};
