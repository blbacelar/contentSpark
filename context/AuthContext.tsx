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

  const lastFetchedUserId = React.useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    // Debounce/De-duplicate identical fetches
    if (lastFetchedUserId.current === userId) return;
    lastFetchedUserId.current = userId;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;

      const response = await fetch('https://n8n.bacelardigital.tech/webhook/get-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile via webhook');
      }

      const data = await response.json();

      if (data) {
        // Handle n8n array response or single object
        const profileData = Array.isArray(data) ? data[0] : data;

        setProfile({
          id: profileData.id,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          avatar_url: profileData.avatar_url,
          credits: profileData.credits ?? 0,
          has_completed_onboarding: profileData.has_completed_onboarding,
          tier: profileData.tier || 'free'
        });
      }
    } catch (err) {
      console.error("Error fetching profile from webhook:", err);
      // Fallback: clear the debounce ref so we can try again if needed
      lastFetchedUserId.current = null;
    }
  };


  useEffect(() => {
    let mounted = true;

    // Listen for changes on auth state (sign in, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AUTH EVENT:', event, session?.user?.email); // DEBUG
      if (!mounted) return;

      // Explicitly handle SIGNED_OUT event
      if (event === 'SIGNED_OUT') {
        console.log('Handling SIGNED_OUT'); // DEBUG
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        lastFetchedUserId.current = null;
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      console.log('Set User:', session?.user?.id); // DEBUG

      if (session?.user) {
        // Fetch profile if user changed or not fetched yet (handled by ref check in fetchProfile)
        fetchProfile(session.user.id).catch(console.error);
      } else {
        setProfile(null);
        lastFetchedUserId.current = null;
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);



  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during supabase signOut:", error);
    } finally {
      // Force clear state to ensure UI updates
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      lastFetchedUserId.current = null;
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