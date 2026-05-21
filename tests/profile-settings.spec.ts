import { test, expect } from './fixtures';
import { deleteTestPersonas, resetUserCredits } from './test-helpers';
import {
  applyStandardTimeouts,
  buildAdminSupabase,
  desktopTestUse,
  openDashboard,
  openProfile,
  updateProfileAndBrandKit,
  createPersonaFromProfile,
} from './app-flow.helpers';

test.use(desktopTestUse);

test.describe('Profile and strategy setup', () => {
  test('user can update profile identity and brand kit', async ({ page, loggedInUser: _loggedInUser }) => {
    test.setTimeout(60_000);
    applyStandardTimeouts(page);

    await test.step('open profile workspace', async () => {
      await openDashboard(page);
      await openProfile(page);
    });

    await test.step('save profile identity and brand kit', async () => {
      await updateProfileAndBrandKit(page, {
        firstName: 'Bruno',
        lastName: 'Bacelar',
        brandColors: ['#0F172A', '#F4C542'],
        style: 'Editorial, practical, high-clarity social strategy visuals.',
      });
    });

    await test.step('confirm updated values remain visible', async () => {
      await expect(page.getByPlaceholder(/Jane|João/i)).toHaveValue('Bruno');
      await expect(page.getByPlaceholder(/Doe|Silva/i)).toHaveValue('Bacelar');
      await expect(page.getByPlaceholder('#000000').nth(0)).toHaveValue('#0F172A');
      await expect(page.getByPlaceholder('#000000').nth(1)).toHaveValue('#F4C542');
    });
  });

  test('user can create a target persona from profile', async ({ page, loggedInUser }) => {
    test.setTimeout(60_000);
    applyStandardTimeouts(page);

    const adminSupabase = buildAdminSupabase();
    const personaName = `QA Persona ${Date.now().toString().slice(-6)}`;

    await test.step('open profile workspace', async () => {
      await openDashboard(page);
      await openProfile(page);
    });

    await test.step('create persona from strategy center', async () => {
      await createPersonaFromProfile(page, {
        name: personaName,
        description: 'Independent creators and small teams that need a repeatable content planning system.',
        ageRange: '28-40',
        occupation: 'Content Strategist',
      });
    });

    await test.step('verify persona selection in UI', async () => {
      await expect(page.locator('#persona-name')).toHaveValue(personaName);
    });

    await test.step('verify persona persistence in database when admin access exists', async () => {
      if (!adminSupabase) {
        return;
      }

      await expect
        .poll(async () => {
          const { data, error } = await adminSupabase
            .from('personas')
            .select('id')
            .eq('user_id', loggedInUser.id)
            .eq('name', personaName)
            .limit(1)
            .maybeSingle();

          if (error) {
            throw new Error(`Persona verification failed: ${error.message}`);
          }

          return data?.id ?? null;
        }, { timeout: 10_000 })
        .toBeTruthy();
    });
  });

  test('generation is blocked when no saved persona exists', async ({ page, loggedInUser }) => {
    test.setTimeout(60_000);
    applyStandardTimeouts(page);

    await deleteTestPersonas(loggedInUser.id);
    await resetUserCredits(loggedInUser.id, 10);

    await test.step('open strategy engine with no personas', async () => {
      await openDashboard(page);
      await page.reload({ waitUntil: 'networkidle' });

      const strategyButton = page.getByRole('button', { name: /New Strategy|Nova Estratégia/i }).first();
      await expect(strategyButton).toBeVisible({ timeout: 15_000 });
      await strategyButton.click();

      await expect(page.getByRole('heading', { name: /Strategy Engine|Motor de Estratégia/i })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('attempt generation and verify persona guard blocks network call', async () => {
      await page.locator('input[name="topic"]').fill('No persona should block this generation');
      await page.locator('input[name="audience"]').fill('Founders');

      const requestObservedPromise = page
        .waitForRequest(
          request => request.url().includes('/functions/v1/generate-content') && request.method() === 'POST',
          { timeout: 4_000 }
        )
        .then(() => true)
        .catch(() => false);

      const generateButton = page.getByRole('button', { name: /Generate Magic|Gerar Mágica/i }).first();
      await expect(generateButton).toBeVisible({ timeout: 10_000 });
      await generateButton.click();

      await expect(page.getByRole('heading', { name: /Target Persona Missing|Persona Alvo Ausente/i })).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: /Set Up Profile|Configurar Perfil/i })).toBeVisible({ timeout: 8_000 });

      const requestObserved = await requestObservedPromise;
      expect(requestObserved).toBeFalsy();
    });
  });
});
