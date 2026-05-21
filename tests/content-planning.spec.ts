import { addDays, format } from 'date-fns';
import { test, expect } from './fixtures';
import {
  applyStandardTimeouts,
  buildAdminSupabase,
  desktopTestUse,
  openDashboard,
  createManualIdea,
  scheduleIdea,
  seedIdeaInDatabase,
} from './app-flow.helpers';

test.use(desktopTestUse);

test.describe('Content planning workflows', () => {
  test('user can create a manual idea from backlog', async ({ page, loggedInUser: _loggedInUser }) => {
    test.setTimeout(45_000);
    applyStandardTimeouts(page);

    const ideaTitle = `Manual QA Idea ${Date.now().toString().slice(-6)}`;

    await test.step('open dashboard', async () => {
      await openDashboard(page);
    });

    await test.step('create manual backlog idea', async () => {
      await createManualIdea(page, ideaTitle);
    });
  });

  test('user can schedule an existing idea and persist the date', async ({ page, loggedInUser }) => {
    test.setTimeout(60_000);
    applyStandardTimeouts(page);

    const adminSupabase = buildAdminSupabase();
    const ideaTitle = `Scheduled QA Idea ${Date.now().toString().slice(-6)}`;
    const scheduleDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    if (!adminSupabase) {
      test.skip(true, 'Service role access is required for seeded scheduling verification.');
      return;
    }

    await test.step('seed a backlog idea in database', async () => {
      await seedIdeaInDatabase(adminSupabase, loggedInUser.id, ideaTitle);
    });

    await test.step('open dashboard and load backlog item', async () => {
      await openDashboard(page);
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: ideaTitle, level: 4 })).toBeVisible({ timeout: 15_000 });
    });

    await test.step('schedule the idea in the calendar modal', async () => {
      await scheduleIdea(page, ideaTitle, { date: scheduleDate, time: '09:30' });
      await expect(page.getByText(/9:30 AM|09:30/i).first()).toBeVisible({ timeout: 12_000 });
    });

    await test.step('verify scheduled values in database', async () => {
      const { data, error } = await adminSupabase
        .from('content_ideas')
        .select('title,date,time,status')
        .eq('user_id', loggedInUser.id)
        .eq('title', ideaTitle)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Scheduled idea verification failed: ${error.message}`);
      }

      expect(data?.date).toBe(scheduleDate);
      expect(data?.time).toBe('09:30');
    });
  });
});
