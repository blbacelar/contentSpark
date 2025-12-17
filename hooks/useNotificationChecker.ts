import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { ContentIdea, UserSettings } from '../types';
import { parseISO, differenceInHours, isPast, isFuture, addHours } from 'date-fns';
import { toast } from 'sonner';

interface UseNotificationCheckerProps {
    userId?: string;
    ideas: ContentIdea[];
}

export const useNotificationChecker = ({ userId, ideas }: UseNotificationCheckerProps) => {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const checkedIdeasRef = useRef<Set<string>>(new Set());
    const hasFetchedRef = useRef(false);

    // 1. Fetch User Settings & Existing Notifications (to init cache)
    useEffect(() => {
        if (!userId) return;

        const init = async () => {
            if (hasFetchedRef.current) return;
            hasFetchedRef.current = true;

            // Fetch Settings
            const { data: settingsData } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (settingsData) {
                setSettings(settingsData);
            }

            // Fetch recently created 'idea_due' notifications to populate ignore list
            // (Only look back 24h to avoid heavy query, or just assume session cache is empty start)
            const { data: recentNotifs } = await supabase
                .from('notifications')
                .select('data')
                .eq('user_id', userId)
                .eq('type', 'idea_due')
                .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (recentNotifs) {
                recentNotifs.forEach((n: any) => {
                    if (n.data?.ideaId) {
                        checkedIdeasRef.current.add(n.data.ideaId);
                    }
                });
            }
        };

        init();
    }, [userId]);

    // 2. Poll / Check Logic
    useEffect(() => {
        if (!userId || !settings?.notify_on_idea_due || !ideas.length) return;

        const checkIdeas = async () => {
            const now = new Date();
            const thresholdHours = settings.idea_due_threshold_hours || 24; // Default 24h if missing

            const dueIdeas = ideas.filter(idea => {
                // Skip if completed/posted or no date
                if (idea.status === 'Completed' || idea.status === 'Posted' || !idea.date) return false;

                // Skip if already notified this session
                if (checkedIdeasRef.current.has(idea.id)) return false;

                try {
                    // FLOATING TIME LOGIC: treat idea date/time as local
                    const timePart = idea.time || '09:00';
                    const dateTimeStr = `${idea.date}T${timePart}:00`;
                    // parseISO treats this as local time (if no Z)
                    const dueDate = parseISO(dateTimeStr);

                    // Logic: Is it in the future, but within threshold?
                    // Or slightly in the past (just missed it)? 
                    // Let's say: Due Date < (Now + Threshold) AND (Due Date > Now - 1h)
                    // This handles "Due in 2 hours" and "Due 10 mins ago" (if we just opened app)

                    const thresholdDate = addHours(now, thresholdHours);
                    const staleDate = addHours(now, -1); // Don't notify for stuff days old

                    // Check boundaries
                    return dueDate <= thresholdDate && dueDate > staleDate;

                } catch (e) {
                    return false;
                }
            });

            if (dueIdeas.length === 0) return;

            // Batch insert notifications
            const notificationsToInsert = dueIdeas.map(idea => ({
                user_id: userId,
                type: 'idea_due',
                title: 'Idea Due Soon',
                message: `"${idea.title}" is scheduled for today.`,
                data: { ideaId: idea.id, dueAt: idea.date },
                read_at: null
            }));

            // Insert to Supabase
            const { error } = await supabase.from('notifications').insert(notificationsToInsert);

            if (!error) {
                // Update Cache & Show Toast
                dueIdeas.forEach(idea => {
                    checkedIdeasRef.current.add(idea.id);
                    toast.info(`Reminder: "${idea.title}" is due soon!`);
                });
            }
        };

        const intervalId = setInterval(checkIdeas, 60 * 1000); // Check every minute
        checkIdeas(); // Run once immediately

        return () => clearInterval(intervalId);
    }, [userId, settings, ideas]);
};
