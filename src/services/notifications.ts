import { supabase } from './supabase';
import { Notification } from '../types';

export const fetchNotifications = async (userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }

    return data;
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

    if (error) {
        console.error('Error marking notification as read:', error);
    }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);

    if (error) {
        console.error('Error marking all notifications as read:', error);
    }
}
