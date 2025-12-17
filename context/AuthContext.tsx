import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, supabaseFetch } from '../services/supabase';
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

  /* 
   * SIMPLIFIED: Direct fetch via Secure RPC
   * Bypasses RLS issues and removes complex caching
   */
  const fetchProfile = async (userId: string, tokenOverride?: string) => {
    try {
      // Use override token if provided, otherwise try to get from state or SDK
      let token = tokenOverride || session?.access_token;

      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }

      if (!token) {
        return;
      }

      // FIX: Use manual fetch to avoid SDK type errors and force headers
      // This is the "smarter" way: simple, explicit, robust.
      const data = await supabaseFetch('rpc/get_my_profile', {
        method: 'POST'
      }, token);

      console.log("AUTH DEBUG: fetchProfile RPC data:", data);

      if (data && data.length > 0) {
        const profileData = data[0];
        setProfile({
          id: profileData.id,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          avatar_url: profileData.avatar_url,
          credits: profileData.credits ?? 0,
          has_completed_onboarding: profileData.has_completed_onboarding,
          tier: profileData.tier || 'free',
          branding: profileData.branding
        });
      } else {
        console.warn("AUTH DEBUG: Profile data empty even with RPC.");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };


  useEffect(() => {
    let mounted = true;

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("Auth check timed out, forcing loading false");
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
        await fetchProfile(initialSession.user.id, initialSession.access_token);
      }
    };

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AUTH EVENT:', event, session?.user?.email);
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id, session.access_token).catch(console.error);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    initAuth().catch(console.error);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);



  const signOut = async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('CS_LAST_TEAM_ID');

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during supabase signOut:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, session?.access_token);
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