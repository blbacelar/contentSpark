-- Enable pg_cron extension (requires supersuser or being enabled in dashboard)
create extension if not exists pg_cron;

-- Create the processing function
create or replace function public.process_due_notifications()
returns void
language plpgsql
as $$
declare
    idea_record record;
    user_setting record;
    threshold_hrs int;
    notify_window timestamp;
begin
    -- Iterate over users who have 'notify_on_idea_due' enabled
    for user_setting in 
        select user_id, idea_due_threshold_hours 
        from public.user_settings 
        where notify_on_idea_due = true
    loop
        -- Default to 24h if null
        threshold_hrs := coalesce(user_setting.idea_due_threshold_hours, 24);
        
        -- Find pending/in-progress ideas for this user that are due within [Now, Now + Threshold]
        -- AND have not been notified yet.
        -- We assume scheduled_at is TIMESTAMPTZ. 
        -- If it stores "22:00:00+00" (UTC), we compare against now() (UTC).
        
        for idea_record in
            select id, title, scheduled_at, user_id
            from public.content_ideas
            where user_id = user_setting.user_id
            and status not in ('Completed', 'Posted')
            and scheduled_at is not null
            and scheduled_at > now() -- Due in future
            and scheduled_at <= (now() + (threshold_hrs || ' hours')::interval) -- Within threshold
            and not exists (
                select 1 from public.notifications 
                where notifications.data->>'ideaId' = content_ideas.id::text
                and notifications.type = 'idea_due'
            )
        loop
            -- Insert Notification
            insert into public.notifications (
                user_id,
                type,
                title,
                message,
                data,
                read_at
            ) values (
                idea_record.user_id,
                'idea_due',
                'Idea Due Soon',
                '"' || idea_record.title || '" is due at ' || to_char(idea_record.scheduled_at, 'HH24:MI'),
                jsonb_build_object('ideaId', idea_record.id, 'dueAt', idea_record.scheduled_at),
                null
            );
        end loop;
    end loop;
end;
$$;

-- Schedule it to run every 10 minutes
-- Note: 'cron.schedule' returns the jobid.
select cron.schedule('check-due-ideas', '*/10 * * * *', $$select public.process_due_notifications()$$);
