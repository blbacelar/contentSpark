import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Team } from '../types';
import { fetchUserTeams, createTeam as createTeamService } from '../services/teams';
import { useAuth } from './AuthContext';

interface TeamContextType {
    teams: Team[];
    currentTeam: Team | null;
    isLoading: boolean;
    error: string | null;
    createTeam: (name: string) => Promise<void>;
    switchTeam: (teamId: string | null) => void; // null = Personal
    refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const creatingDefaultRef = useRef(false);
    const isInitialized = useRef(false);

    // Load teams when user adds
    const loadTeams = async () => {
        if (!user) {
            setTeams([]);
            setCurrentTeam(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            let data = await fetchUserTeams(user.id);

            // Auto-create default team if none exists
            if (data.length === 0 && !creatingDefaultRef.current) {
                creatingDefaultRef.current = true;
                try {
                    console.log("No teams found, creating default team...");
                    // Ideally use profile name, but might not be loaded yet inside this context easily unless passed
                    // We'll use a generic name or try to get it from metadata
                    const defaultName = "Personal Team";
                    const newTeam = await createTeamService(defaultName, user.id);
                    if (newTeam) {
                        data = [newTeam];
                    }
                } finally {
                    creatingDefaultRef.current = false;
                }
            }

            setTeams(data);

            // Auto-select first team if no team is selected AND not yet initialized
            // This prevents forcing the user out of "Personal View" (null) on re-fetches
            if (!isInitialized.current && !currentTeam && data.length > 0) {
                setCurrentTeam(data[0]);
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
        loadTeams();
    }, [user]);

    const createTeam = async (name: string) => {
        if (!user) return;
        // Let error bubble up to component
        try {
            const newTeam = await createTeamService(name, user.id);
            if (newTeam) {
                await loadTeams();
                setCurrentTeam(newTeam);
            }
        } catch (err: any) {
            setError(err.message || "Failed to create team");
            throw err;
        }
    };

    const switchTeam = (teamId: string | null) => {
        if (teamId === null) {
            setCurrentTeam(null);
        } else {
            const team = teams.find(t => t.id === teamId);
            if (team) setCurrentTeam(team);
        }
    };

    const value = React.useMemo(() => ({
        teams,
        currentTeam,
        isLoading,
        error,
        createTeam,
        switchTeam,
        refreshTeams: loadTeams
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
