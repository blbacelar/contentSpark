import { supabase } from './supabase';
import { UserSettings } from '../types';

export const fetchUserSettings = async (userId: string): Promise<UserSettings | null> => {
    const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, notify_on_team_join, notify_on_idea_due, idea_due_threshold_hours')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching user settings:', error);
        return null;
    }

    return data;
};

export const updateUserSettings = async (settings: UserSettings): Promise<void> => {
    const { error } = await supabase
        .from('user_settings')
        .upsert(settings);

    if (error) {
        console.error('Error updating user settings:', error);
        throw error;
    }
};
