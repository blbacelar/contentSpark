import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateCredits: (newCount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, credits')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
      }
      
      if (data) {
        setProfile({
            id: data.id,
            first_name: data.first_name,
            last_name: data.last_name,
            avatar_url: data.avatar_url,
            credits: data.credits ?? 0 // Default to 0 if null
        });
      }
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check active sessions and sets the user
    const initSession = async () => {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Session init error:", error);
                throw error;
            }
            
            if (mounted) {
                const session = data?.session ?? null;
                setSession(session);
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            }
        } catch (err) {
            console.error("Auth initialization failed:", err);
        } finally {
            if (mounted) {
                setLoading(false);
            }
        }
    };

    initSession();

    // Listen for changes on auth state (sign in, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
         await fetchProfile(session.user.id);
      } else {
         setProfile(null);
      }
      setLoading(false);
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
      if (user) {
          await fetchProfile(user.id);
      }
  };

  const updateCredits = (newCount: number) => {
      setProfile(prev => prev ? { ...prev, credits: newCount } : null);
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    updateCredits
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}