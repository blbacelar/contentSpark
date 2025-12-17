import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from environment
const supabaseUrl = process.env.TEST_SUPABASE_URL!;
const supabaseKey = process.env.TEST_SUPABASE_KEY!;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

// Create clients
const supabase = createClient(supabaseUrl, supabaseKey);
const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

/**
 * Delete all content ideas created by a specific user
 */
export async function deleteTestIdeas(userId: string): Promise<void> {
    console.log(`[Cleanup] Deleting ideas for user: ${userId}`);

    const { error } = await supabase
        .from('content_ideas')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('[Cleanup] Error deleting ideas:', error);
    } else {
        console.log('[Cleanup] Ideas deleted successfully');
    }
}

/**
 * Delete all teams owned by a specific user and associated memberships
 */
export async function deleteTestTeams(userId: string): Promise<void> {
    console.log(`[Cleanup] Deleting teams for user: ${userId}`);

    // First get team IDs owned by user
    const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', userId);

    if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);

        // Delete team memberships
        const { error: memberError } = await supabase
            .from('team_members')
            .delete()
            .in('team_id', teamIds);

        if (memberError) {
            console.error('[Cleanup] Error deleting team members:', memberError);
        }

        // Delete teams
        const { error: teamError } = await supabase
            .from('teams')
            .delete()
            .eq('owner_id', userId);

        if (teamError) {
            console.error('[Cleanup] Error deleting teams:', teamError);
        } else {
            console.log('[Cleanup] Teams deleted successfully');
        }
    }
}

/**
 * Delete all personas created by a specific user
 */
export async function deleteTestPersonas(userId: string): Promise<void> {
    console.log(`[Cleanup] Deleting personas for user: ${userId}`);

    const { error } = await supabase
        .from('personas')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('[Cleanup] Error deleting personas:', error);
    } else {
        console.log('[Cleanup] Personas deleted successfully');
    }
}

/**
 * Delete all notifications for a specific user
 */
export async function deleteTestNotifications(userId: string): Promise<void> {
    console.log(`[Cleanup] Deleting notifications for user: ${userId}`);

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('[Cleanup] Error deleting notifications:', error);
    } else {
        console.log('[Cleanup] Notifications deleted successfully');
    }
}

/**
 * Delete a user from Supabase Auth
 * Requires service role key - DO NOT use for persistent test users!
 */
export async function deleteAuthUser(userId: string): Promise<void> {
    if (!adminClient) {
        console.warn('[Cleanup] Cannot delete auth user - service role key not provided');
        return;
    }

    console.log(`[Cleanup] Deleting auth user: ${userId}`);

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
        console.error('[Cleanup] Error deleting auth user:', error);
    } else {
        console.log('[Cleanup] Auth user deleted successfully');
    }
}

/**
 * Master cleanup function - removes all test data for a user
 * @param userId - The user ID to clean up
 * @param includeAuthUser - Whether to delete the auth user (default: false)
 */
export async function cleanupTestData(userId: string, includeAuthUser: boolean = false): Promise<void> {
    console.log(`[Cleanup] Starting cleanup for user: ${userId}`);

    try {
        // Delete in proper order (respecting foreign keys)
        await deleteTestNotifications(userId);
        await deleteTestIdeas(userId);
        await deleteTestTeams(userId);
        await deleteTestPersonas(userId);

        // Only delete auth user if explicitly requested
        if (includeAuthUser) {
            await deleteAuthUser(userId);
        }

        console.log('[Cleanup] Cleanup completed successfully');
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error);
        throw error;
    }
}

/**
 * Reset test user credits to a specific amount
 */
export async function resetUserCredits(userId: string, credits: number = 10): Promise<void> {
    console.log(`[Cleanup] Resetting credits to ${credits} for user: ${userId}`);

    const { error } = await supabase
        .from('profiles')
        .update({ credits })
        .eq('id', userId);

    if (error) {
        console.error('[Cleanup] Error resetting credits:', error);
    } else {
        console.log('[Cleanup] Credits reset successfully');
    }
}
