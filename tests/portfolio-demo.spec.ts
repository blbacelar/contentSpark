import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

test.use({
    video: 'on',
    viewport: { width: 1440, height: 960 }
});

test.describe('Portfolio demo recording', () => {
    test('records the full product walkthrough', async ({ page, loggedInUser }) => {
        test.setTimeout(120_000);

        const screenshotsDir = path.resolve('docs', 'demo', 'screenshots');
        fs.mkdirSync(screenshotsDir, { recursive: true });

        const demoProfile = {
            firstName: 'Avery',
            lastName: 'Stone'
        };
        const demoBrandColors = ['#0F172A', '#F4C542'];
        const demoBrandStyle = 'Editorial, optimistic, strategy-first.';
        const demoPersonaName = `Demo Persona ${Date.now().toString().slice(-6)}`;
        const demoIdeaTitle = 'Portfolio Demo Idea';
        let generationIntercepted = false;

        const capture = async (fileName: string, waitMs: number = 1200, targetPage = page) => {
            await targetPage.waitForTimeout(waitMs);
            await targetPage.screenshot({
                path: path.join(screenshotsDir, fileName),
                fullPage: true,
            });
        };

        const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY must be set for portfolio demo setup.');
        }

        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

        const resetCredits = async () => {
            await adminSupabase
                .from('profiles')
                .update({ credits: 10 })
                .eq('id', loggedInUser.id);
        };

        const openStrategyEngine = async (): Promise<boolean> => {
            const strategyButton = page.getByRole('button', { name: /New Strategy|Nova Estratégia/i }).first();
            const isVisible = await strategyButton.isVisible({ timeout: 8_000 }).catch(() => false);

            if (isVisible) {
                await strategyButton.click();
                return true;
            }

            const outOfCreditsVisible = await page.getByText(/Out of Credits|Sem Créditos/i).first().isVisible({ timeout: 2_000 }).catch(() => false);
            if (outOfCreditsVisible) {
                await resetCredits();
                await page.reload({ waitUntil: 'networkidle' });
            }

            const retryButton = page.getByRole('button', { name: /New Strategy|Nova Estratégia/i }).first();
            const retryVisible = await retryButton.isVisible({ timeout: 8_000 }).catch(() => false);
            if (retryVisible) {
                await retryButton.click();
                return true;
            }

            return false;
        };

        const { data: existingMembership } = await adminSupabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', loggedInUser.id)
            .limit(1)
            .maybeSingle();

        let activeTeamId = existingMembership?.team_id || null;

        if (!existingMembership?.team_id) {
            const invitationCode = `demo${Date.now().toString().slice(-8)}`;
            const { data: createdTeam, error: createTeamError } = await adminSupabase
                .from('teams')
                .insert({
                    name: 'Portfolio Demo Team',
                    owner_id: loggedInUser.id,
                    invitation_code: invitationCode
                })
                .select('id')
                .single();

            if (createTeamError || !createdTeam?.id) {
                throw new Error(`Unable to create demo team for test user: ${createTeamError?.message || 'unknown error'}`);
            }

            const { error: memberError } = await adminSupabase
                .from('team_members')
                .insert({
                    team_id: createdTeam.id,
                    user_id: loggedInUser.id,
                    role: 'owner'
                });

            if (memberError) {
                throw new Error(`Unable to create demo team membership: ${memberError.message}`);
            }

            activeTeamId = createdTeam.id;
        }

        await adminSupabase
            .from('content_ideas')
            .delete()
            .eq('user_id', loggedInUser.id);

        await adminSupabase
            .from('personas')
            .delete()
            .eq('user_id', loggedInUser.id);

        if (activeTeamId) {
            await adminSupabase
                .from('teams')
                .update({ branding: { colors: [], fonts: {}, style: '' } })
                .eq('id', activeTeamId);
        }

        await page.route('**/functions/v1/generate-content**', async route => {
            generationIntercepted = true;
            // Keep a short, visible loading phase so the demo clearly shows "waiting for ideas".
            await page.waitForTimeout(2_000);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    text: JSON.stringify([
                        {
                            title: demoIdeaTitle,
                            description: 'A realistic sample idea generated for portfolio walkthrough.',
                            hook: 'Stop wasting posts that do not convert',
                            caption: 'A demo caption proving strategy-first generation with persona context.',
                            cta: 'Save this workflow and adapt it this week.',
                            hashtags: '#contentstrategy #aiworkflow #playwright',
                            platform: ['Instagram', 'LinkedIn']
                        },
                        {
                            title: 'Content Repurposing Pipeline',
                            description: 'Turn one long-form asset into multiple social posts.',
                            hook: 'One asset, five channels',
                            caption: 'Repurpose systematically with tone and audience alignment.',
                            cta: 'Comment PIPELINE for the template.',
                            hashtags: '#repurposing #growth #creatorops',
                            platform: ['LinkedIn']
                        }
                    ])
                })
            });
        });

        // 1) Public entry flow (landing -> login) on a fresh page
        const publicPage = await page.context().newPage();
        await publicPage.goto('/');
        await expect(publicPage).toHaveURL(/\/$|\/login/);
        await capture('01-landing-page.png', 900, publicPage);

        const startButton = publicPage.getByRole('button', { name: /Start Creating|Get Started/i }).first();
        if (await startButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await startButton.click();
            await expect(publicPage).toHaveURL(/\/login/);
        } else {
            await publicPage.goto('/login');
            await expect(publicPage).toHaveURL(/\/login/);
        }
        await capture('02-login-page.png', 800, publicPage);
        await publicPage.close();

        // 2) Authenticated app/dashboard
        await page.goto('/app');
        await expect(page).toHaveURL(/\/app/);
        await expect(page.getByText('ContentSpark').first()).toBeVisible({ timeout: 15_000 });
        await capture('03-dashboard-overview.png');

        // 3) Profile setup + brand kit + persona creation
        const profileButton = page.locator('div.border-t.border-gray-200 > button').last();
        await expect(profileButton).toBeVisible({ timeout: 10_000 });
        await profileButton.click({ force: true });
        await page.waitForLoadState('networkidle');

        await expect(page.getByPlaceholder(/Jane|João/i)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('heading', { name: /Brand Kit/i })).toBeVisible();

        await page.getByPlaceholder(/Jane|João/i).fill(demoProfile.firstName);
        await page.getByPlaceholder(/Doe|Silva/i).fill(demoProfile.lastName);
        await capture('04-profile-created.png', 900);

        const addColorButton = page.getByRole('button', { name: /Add Color/i });
        const existingColorInputs = page.getByPlaceholder('#000000');
        const existingColorCount = await existingColorInputs.count();
        for (let index = existingColorCount; index < demoBrandColors.length; index += 1) {
            await addColorButton.click();
        }

        for (const [index, color] of demoBrandColors.entries()) {
            await page.getByPlaceholder('#000000').nth(index).fill(color);
        }

        await page.getByPlaceholder('e.g. Modern, Minimalist, Vibrant...').fill(demoBrandStyle);
        await capture('05-brand-kit.png', 900);

        const saveBrandKitButton = page.getByRole('button', { name: /Save Brand Kit|Salvar Kit de Marca/i });
        await expect(saveBrandKitButton).toBeVisible({ timeout: 10_000 });
        await saveBrandKitButton.click();
        await expect(page.getByText(/Profile updated successfully!|Perfil atualizado com sucesso!/i)).toBeVisible({ timeout: 10_000 });

        const personaSelector = page.locator('#tour-persona-card button[role="combobox"]').first();
        await expect(personaSelector).toBeVisible({ timeout: 10_000 });
        await personaSelector.click({ force: true });

        const createPersonaOption = page.getByRole('option', { name: /Create New Persona|Criar Nova Persona/i });
        if (await createPersonaOption.count()) {
            await createPersonaOption.first().click({ force: true });
        }

        await page.locator('#persona-name').fill(demoPersonaName);
        await page.locator('#persona-description').fill('Independent creators and micro teams that need repeatable content systems.');

        const savePersonaButton = page.getByRole('button', { name: /Save Strategy|Salvar Estratégia/i });
        await expect(savePersonaButton).toBeVisible({ timeout: 10_000 });
        await savePersonaButton.click();
        await page.waitForTimeout(1_500);

        const { data: persistedPersona } = await adminSupabase
            .from('personas')
            .select('id')
            .eq('user_id', loggedInUser.id)
            .eq('name', demoPersonaName)
            .limit(1)
            .maybeSingle();

        if (!persistedPersona?.id && activeTeamId) {
            await adminSupabase
                .from('personas')
                .insert({
                    user_id: loggedInUser.id,
                    team_id: activeTeamId,
                    name: demoPersonaName,
                    description: 'Independent creators and micro teams that need repeatable content systems.',
                    age_range: '25-34',
                    occupation: 'Content Creator',
                    pains_list: ['Inconsistent publishing cadence'],
                    goals_list: ['Publish high-quality content consistently'],
                    questions_list: ['What should I post next week?']
                });
        }

            await capture('06-persona-created.png', 1_400);

        await page.getByRole('button', { name: /Back to Calendar|Voltar ao Calendário/i }).click();
        await expect(page).toHaveURL(/\/app/);
        await page.reload({ waitUntil: 'networkidle' });

            // 4) Generation with persona selection
        const secondEngineOpened = await openStrategyEngine();
        if (secondEngineOpened) {
            await expect(page.getByRole('heading', { name: /Strategy Engine|Motor de Estratégia/i })).toBeVisible();

            const targetPersonaBlock = page.locator('div.space-y-2').filter({ hasText: /Target Persona|Persona Alvo/i }).first();
            const personaCombobox = targetPersonaBlock.getByRole('combobox');
            await personaCombobox.click({ force: true });

            const demoPersonaOption = page.getByRole('option', { name: demoPersonaName });
            if (await demoPersonaOption.count()) {
                await demoPersonaOption.first().click({ force: true });
            } else {
                const fallbackPersonaOption = page.getByRole('option').first();
                if (await fallbackPersonaOption.count()) {
                    await fallbackPersonaOption.click({ force: true });
                }
                await page.keyboard.press('Escape');
            }

            await page.getByPlaceholder(/Cooking|Culinária/i).fill('Content systems for lean teams');
            await page.getByPlaceholder(/Busy Moms|Mães ocupadas/i).fill('Solo founders and small marketing teams');

            const generateButton = page.getByRole('button', { name: /Generate Magic|Gerar Mágica/i });
            await expect(generateButton).toBeVisible({ timeout: 10_000 });
            await generateButton.click();

            await page
                .getByRole('button', { name: /Continue Anyway|Continuar Assim Mesmo/i })
                .click({ timeout: 8_000 })
                .catch(() => null);

            await page.getByRole('button', { name: /Consulting AI|Gerando ideias/i }).first().waitFor({ state: 'visible', timeout: 6_000 }).catch(() => null);
        } else {
            console.warn('[Portfolio Demo] Strategy Engine was unavailable in the generation pass; seeding fallback idea.');
        }
        const generatedIdeaHeading = page.getByRole('heading', { name: demoIdeaTitle, level: 4 });
        const ideaVisible = await generatedIdeaHeading.isVisible({ timeout: 12_000 }).catch(() => false);

        if (!ideaVisible && activeTeamId) {
            await adminSupabase
                .from('content_ideas')
                .insert([
                    {
                        user_id: loggedInUser.id,
                        team_id: activeTeamId,
                        title: demoIdeaTitle,
                        description: 'Demo generated idea for scheduling walkthrough.',
                        status: 'Pending'
                    },
                    {
                        user_id: loggedInUser.id,
                        team_id: activeTeamId,
                        title: 'Content Repurposing Pipeline',
                        description: 'Demo generated backup idea.',
                        status: 'Pending'
                    }
                ]);

            await page.reload({ waitUntil: 'networkidle' });

            const visibleAfterSeed = await generatedIdeaHeading.isVisible({ timeout: 8_000 }).catch(() => false);
            if (!visibleAfterSeed) {
                const manualCreateButton = page.getByTitle(/Add Manual Idea|Adicionar Ideia Manual/i).first();
                await expect(manualCreateButton).toBeVisible({ timeout: 10_000 });
                await manualCreateButton.click();

                const createModal = page.locator('[role="dialog"]').filter({ hasText: /Create New Idea|Criar Nova Ideia/i }).first();
                await expect(createModal).toBeVisible({ timeout: 10_000 });
                await createModal.getByPlaceholder(/Idea Title|Título da Ideia/i).fill(demoIdeaTitle);
                await createModal.getByTestId('event-modal-save-btn').click();
                await expect(createModal).not.toBeVisible({ timeout: 10_000 });
            }

            await expect(generatedIdeaHeading).toBeVisible({ timeout: 15_000 });
        } else {
            await expect(generatedIdeaHeading).toBeVisible({ timeout: 20_000 });
        }

        await capture('07-generated-ideas.png', 1_000);

        if (!generationIntercepted) {
            // Keep a soft signal in test logs without failing the recording flow.
            console.warn('[Portfolio Demo] generate-content route was not intercepted; fallback path may have been used.');
        }

        // 5) Open idea editor for an explicit edit-state screenshot
        const draggableIdea = generatedIdeaHeading.first();
        await draggableIdea.click();

        const editModal = page.locator('[role="dialog"]').filter({ hasText: /Edit Content|Editar Conteúdo/i }).first();
        await expect(editModal).toBeVisible({ timeout: 10_000 });
        await capture('08-idea-editor.png', 700);

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDay = `${tomorrow.getDate()}`;
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);

        await editModal.locator('input[type="date"]').fill(tomorrowIso);
        await editModal.getByTestId('event-modal-save-btn').click();
        await expect(editModal).not.toBeVisible({ timeout: 10_000 });

        const targetDayNumber = page.locator('#tour-calendar span').filter({ hasText: new RegExp(`^${tomorrowDay}$`) }).first();
        const targetDayCell = targetDayNumber.locator('xpath=ancestor::div[contains(@class, "min-h-[120px]")]').first();

        await expect(targetDayCell).toBeVisible({ timeout: 10_000 });

        const unscheduledIdea = page.getByRole('heading', { name: demoIdeaTitle, level: 4 }).first();
        if (await unscheduledIdea.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await unscheduledIdea.dragTo(targetDayCell).catch(() => null);
        }

        const calendarIdeaLocator = page.locator('#tour-calendar').getByText(demoIdeaTitle);
        let isScheduledInCalendar = await calendarIdeaLocator.isVisible({ timeout: 4_000 }).catch(() => false);

        if (!isScheduledInCalendar) {
            const sourceBox = await unscheduledIdea.boundingBox();
            const targetBox = await targetDayCell.boundingBox();

            if (sourceBox && targetBox) {
                await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
                await page.mouse.down();
                await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
                await page.mouse.up();
            }

            isScheduledInCalendar = await calendarIdeaLocator.isVisible({ timeout: 4_000 }).catch(() => false);
        }

        await expect(calendarIdeaLocator).toBeVisible({ timeout: 10_000 });
        await capture('09-calendar-scheduled.png', 1_000);
    });
});