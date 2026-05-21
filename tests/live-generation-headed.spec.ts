import { addDays, format } from 'date-fns';
import { test, expect } from './fixtures';
import { resetUserCredits } from './test-helpers';
import {
  applyStandardTimeouts,
  buildAdminSupabase,
  desktopTestUse,
  openDashboard,
  openProfile,
  returnToCalendar,
  scheduleIdea,
  updateProfileAndBrandKit,
  createPersonaFromProfile,
} from './app-flow.helpers';

test.use(desktopTestUse);

test.describe('Live headed generation flow', () => {
  test('real generation creates an idea that can be scheduled', async ({ page, loggedInUser }) => {
    test.setTimeout(150_000);
    applyStandardTimeouts(page);

    const adminSupabase = buildAdminSupabase();
    if (!adminSupabase) {
      test.skip(true, 'Service role access is required for live generation verification.');
      return;
    }

    const uniqueSuffix = Date.now().toString().slice(-6);
    const personaName = `Live Persona ${uniqueSuffix}`;
    const runStartedAt = new Date().toISOString();
    const scheduleDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    await adminSupabase
      .from('profiles')
      .upsert({
        id: loggedInUser.id,
        credits: 20,
        tier: 'free',
        has_completed_onboarding: true,
      });

    await resetUserCredits(loggedInUser.id, 20);

    await test.step('configure profile and create a live persona', async () => {
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
        description: 'Founders and small marketing teams that need weekly content ideas with clear execution steps.',
        ageRange: '28-40',
        occupation: 'Content Strategist',
      });
    });

    await test.step('open strategy engine and submit a real generation request', async () => {
      await returnToCalendar(page);
      await page.reload({ waitUntil: 'networkidle' });

      const { data: membership } = await adminSupabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', loggedInUser.id)
        .limit(1)
        .maybeSingle();

      await adminSupabase
        .from('personas')
        .insert({
          user_id: loggedInUser.id,
          team_id: membership?.team_id ?? null,
          name: personaName,
          description: 'Founders and small marketing teams that need weekly content ideas with clear execution steps.',
          gender: 'All',
          age_range: '28-40',
          occupation: 'Content Strategist',
          education: 'Bachelor',
          marital_status: 'Single',
          has_children: false,
          income_level: 'Middle',
          social_networks: 'Instagram, LinkedIn',
          pains_list: ['Lack of consistent content pipeline'],
          goals_list: ['Build a repeatable weekly content system'],
          questions_list: ['What should I post this week?']
        });

      await page.evaluate(() => {
        const cacheKeys = Object.keys(window.localStorage).filter(
          key => key.startsWith('CS_CACHE_V2_PERSONAS')
        );
        for (const key of cacheKeys) {
          window.localStorage.removeItem(key);
        }
      });

      await page.reload({ waitUntil: 'networkidle' });

      const strategyButton = page.getByRole('button', { name: /New Strategy|Nova Estratégia/i }).first();
      let strategyVisible = await strategyButton.isVisible({ timeout: 5_000 }).catch(() => false);
      for (let attempt = 0; attempt < 3 && !strategyVisible; attempt += 1) {
        await adminSupabase
          .from('profiles')
          .upsert({
            id: loggedInUser.id,
            credits: 20,
            tier: 'free',
            has_completed_onboarding: true,
          });
        await page.reload({ waitUntil: 'networkidle' });
        strategyVisible = await strategyButton.isVisible({ timeout: 5_000 }).catch(() => false);
      }

      await expect(strategyButton).toBeVisible({ timeout: 15_000 });
      await strategyButton.click();

      await expect(page.getByRole('heading', { name: /Strategy Engine|Motor de Estratégia/i })).toBeVisible({ timeout: 10_000 });

      const targetPersonaBlock = page.locator('div.space-y-2').filter({ hasText: /Target Persona|Persona Alvo/i }).first();
      const personaCombobox = targetPersonaBlock.getByRole('combobox');
      await personaCombobox.click({ force: true });

      await expect.poll(
        async () => page.getByRole('option').count(),
        { timeout: 15_000, intervals: [500, 1_000, 2_000] }
      ).toBeGreaterThan(0);

      const explicitPersonaOption = page.getByRole('option', { name: personaName }).first();
      const explicitPersonaVisible = await explicitPersonaOption.isVisible({ timeout: 2_000 }).catch(() => false);
      if (explicitPersonaVisible) {
        await explicitPersonaOption.click({ force: true });
      } else {
        const fallbackPersonaOption = page.getByRole('option').first();
        const fallbackVisible = await fallbackPersonaOption.isVisible({ timeout: 2_000 }).catch(() => false);
        if (fallbackVisible) {
          await fallbackPersonaOption.click({ force: true });
        } else {
          await page.keyboard.press('Escape').catch(() => null);
        }
      }

      await page.locator('input[name="topic"]').fill(`Lean content systems ${uniqueSuffix}`);
      await page.locator('input[name="audience"]').fill('Solo founders and small marketing teams');

      const generationResponsePromise = page.waitForResponse(
        response => response.url().includes('/functions/v1/generate-content') && response.request().method() === 'POST',
        { timeout: 45_000 }
      ).catch(() => null);

      const generateButton = page.getByRole('button', { name: /Generate Magic|Gerar Mágica/i });
      await expect(generateButton).toBeVisible({ timeout: 10_000 });
      await generateButton.click();

      await page.getByRole('button', { name: /Continue Anyway|Continuar Assim Mesmo/i }).click({ timeout: 8_000 }).catch(() => null);

      const generationResponse = await generationResponsePromise;
      if (!generationResponse) {
        throw new Error('No live generate-content network response was observed.');
      }

      const responseBody = await generationResponse.text().catch(() => '');
      console.log(`[Live Generation] Response status: ${generationResponse.status()}`);
      console.log(`[Live Generation] Response body preview: ${responseBody.slice(0, 600)}`);

      expect(generationResponse.ok(), `Live generation failed: ${responseBody}`).toBeTruthy();
    });

    let generatedIdeaTitle = '';

    await test.step('verify a real idea was persisted and visible in the UI', async () => {
      const fetchLatestGeneratedTitle = async () => {
        const { data, error } = await adminSupabase
          .from('content_ideas')
          .select('title,created_at')
          .eq('user_id', loggedInUser.id)
          .gte('created_at', runStartedAt)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          throw new Error(`Failed to verify generated ideas: ${error.message}`);
        }

        return data?.[0]?.title ?? '';
      };

      await expect.poll(fetchLatestGeneratedTitle, { timeout: 45_000, intervals: [1_000, 2_000, 5_000] }).not.toBe('');
      generatedIdeaTitle = await fetchLatestGeneratedTitle();

      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: generatedIdeaTitle, level: 4 }).first()).toBeVisible({ timeout: 20_000 });
      console.log(`[Live Generation] Generated idea title: ${generatedIdeaTitle}`);
    });

    await test.step('schedule the generated idea and verify persistence', async () => {
      await scheduleIdea(page, generatedIdeaTitle, { date: scheduleDate, time: '09:30' });

      await expect.poll(async () => {
        const { data, error } = await adminSupabase
          .from('content_ideas')
          .select('date,time')
          .eq('user_id', loggedInUser.id)
          .eq('title', generatedIdeaTitle)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to verify scheduling: ${error.message}`);
        }

        return `${data?.date ?? ''} ${data?.time ?? ''}`.trim();
      }, { timeout: 20_000, intervals: [1_000, 2_000, 5_000] }).toBe(`${scheduleDate} 09:30`);
    });
  });
});