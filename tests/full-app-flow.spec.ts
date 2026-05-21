import { resetUserCredits } from './test-helpers';
import { test, expect } from './fixtures';
import {
  applyStandardTimeouts,
  desktopTestUse,
  openDashboard,
  openProfile,
  returnToCalendar,
  updateProfileAndBrandKit,
  createPersonaFromProfile,
  createManualIdea,
} from './app-flow.helpers';

test.use(desktopTestUse);

test.describe('Cross-flow smoke coverage', () => {
  test('user can move from setup flow back to planning entry points', async ({ page, loggedInUser }) => {
    test.setTimeout(75_000);
    applyStandardTimeouts(page);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const personaName = `E2E Persona ${uniqueSuffix}`;
    await resetUserCredits(loggedInUser.id, 40);

    await test.step('configure profile and persona', async () => {
      await openDashboard(page);
      await openProfile(page);
      await updateProfileAndBrandKit(page, {
        firstName: 'Bruno',
        lastName: 'Bacelar',
        brandColors: ['#0F172A', '#F4C542'],
        style: 'Editorial, practical, high-clarity social strategy visuals.',
      });
      await createPersonaFromProfile(page, {
        name: personaName,
        description: 'Small teams and solo founders needing repeatable weekly content systems.',
        ageRange: '28-40',
        occupation: 'Content Strategist',
      });
    });

    await test.step('return to planning and create a backlog idea', async () => {
      await returnToCalendar(page);
      await page.reload({ waitUntil: 'networkidle' });
      await createManualIdea(page, `Cross Flow Idea ${uniqueSuffix}`);
    });
  });
});
