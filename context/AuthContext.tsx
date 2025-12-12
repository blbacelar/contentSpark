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
      const response = await fetch('https://n8n.bacelardigital.tech/webhook/get-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile via webhook');
      }

      const data = await response.json();

      if (data) {
        // Ensure data is mapped correctly from webhook response
        // n8n might return a single object or an array
        const profileData = Array.isArray(data) ? data[0] : data;

        setProfile({
          id: profileData.id,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          avatar_url: profileData.avatar_url,
          credits: profileData.credits ?? 0,
          has_completed_onboarding: profileData.has_completed_onboarding,
          tier: profileData.tier || 'free' // Default to free if missing
        });
      }
    } catch (err) {
      console.error("Error fetching profile from webhook:", err);
      // Fallback or retry logic could go here if critical
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

    // Safety timeout to prevent infinite loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    // Listen for changes on auth state (sign in, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Explicitly handle SIGNED_OUT event
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
        // Don't await this inside the listener to avoid blocking UI updates if it hangs
        fetchProfile(session.user.id).catch(console.error);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
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