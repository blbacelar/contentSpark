import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

export const desktopTestUse = {
  video: 'on' as const,
  viewport: { width: 1440, height: 960 },
};

export function applyStandardTimeouts(page: Page) {
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(20_000);
}

export function buildAdminSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function openDashboard(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/app');

    if (page.url().includes('/app')) {
      break;
    }

    await page.waitForLoadState('networkidle').catch(() => null);
  }

  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Sign Out|Sair/i }).first()).toBeVisible({ timeout: 20_000 });
}

export async function openProfile(page: Page) {
  const profileButton = page
    .getByRole('button')
    .filter({ hasText: /@|Settings|Configurações/i })
    .last();
  await expect(profileButton).toBeVisible({ timeout: 15_000 });
  await profileButton.click({ force: true });

  await expect(page.getByPlaceholder(/Jane|João/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Brand Kit/i })).toBeVisible();
}

export async function returnToCalendar(page: Page) {
  await page.getByRole('button', { name: /Back to Calendar|Voltar ao Calendário/i }).click();
  await expect(page).toHaveURL(/\/app/);
}

export async function updateProfileAndBrandKit(
  page: Page,
  options: {
    firstName: string;
    lastName: string;
    brandColors: string[];
    style: string;
  }
) {
  await page.getByPlaceholder(/Jane|João/i).fill(options.firstName);
  await page.getByPlaceholder(/Doe|Silva/i).fill(options.lastName);

  const avatarInput = page.locator('input[type="file"]').first();
  await avatarInput.setInputFiles(path.resolve('tests', 'fixtures', 'avatar.svg'));

  const addColorButton = page.getByRole('button', { name: /Add Color/i });
  const colorInputs = page.getByPlaceholder('#000000');
  let currentColorCount = await colorInputs.count();

  while (currentColorCount < options.brandColors.length) {
    await addColorButton.click();
    await expect(colorInputs).toHaveCount(currentColorCount + 1, { timeout: 5_000 });
    currentColorCount += 1;
  }

  for (const [index, color] of options.brandColors.entries()) {
    await colorInputs.nth(index).fill(color);
  }

  await page.getByPlaceholder('e.g. Modern, Minimalist, Vibrant...').fill(options.style);

  const saveBrandKitButton = page.getByRole('button', { name: /Save Brand Kit|Salvar Kit de Marca/i });
  await expect(saveBrandKitButton).toBeVisible({ timeout: 10_000 });
  await saveBrandKitButton.click();
  await expect(page.getByText(/Profile updated successfully!|Perfil atualizado com sucesso!/i)).toBeVisible({ timeout: 12_000 });
}

export async function createPersonaFromProfile(
  page: Page,
  options: {
    name: string;
    description: string;
    ageRange?: string;
    occupation?: string;
  }
) {
  const personaSelector = page.locator('#tour-persona-card button[role="combobox"]').first();
  await expect(personaSelector).toBeVisible({ timeout: 10_000 });
  await personaSelector.click({ force: true });

  const createPersonaOption = page.getByRole('option', { name: /Create New Persona|Criar Nova Persona/i });
  if (await createPersonaOption.count()) {
    await createPersonaOption.first().click({ force: true });
  } else {
    const firstPersonaOption = page.getByRole('option').first();
    if (await firstPersonaOption.count()) {
      await firstPersonaOption.click({ force: true });
    }
  }

  await page.locator('#persona-name').fill(options.name);
  await page.locator('#persona-description').fill(options.description);

  if (options.ageRange) {
    await page.getByPlaceholder(/25-34|Idade/i).first().fill(options.ageRange).catch(() => null);
  }

  if (options.occupation) {
    await page.getByPlaceholder(/marketing|Marketing/i).first().fill(options.occupation).catch(() => null);
  }

  const savePersonaButton = page.getByRole('button', { name: /Save Strategy|Salvar Estratégia/i });
  await expect(savePersonaButton).toBeVisible({ timeout: 10_000 });
  await savePersonaButton.click();
}

export async function createManualIdea(page: Page, title: string) {
  const manualCreateButton = page.locator('button[title="Add Manual Idea"], button[title="Adicionar Ideia Manual"]').first();
  await expect(manualCreateButton).toBeVisible({ timeout: 15_000 });
  await manualCreateButton.click();

  const createModal = page.locator('[role="dialog"]').filter({ hasText: /Create New Idea|Criar Nova Ideia/i }).first();
  await expect(createModal).toBeVisible({ timeout: 10_000 });
  await createModal.getByPlaceholder(/Idea Title|Título da Ideia/i).fill(title);
  await createModal.getByTestId('event-modal-save-btn').click();
  await expect(createModal).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
}

export async function scheduleIdea(page: Page, title: string, options: { date: string; time: string }) {
  await page.getByRole('heading', { name: title, level: 4 }).click();

  const modal = page.locator('[role="dialog"]').filter({ hasText: /Edit Content|Editar Conteúdo/i }).first();
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await modal.locator('input[type="date"]').fill(options.date);
  await modal.locator('input[type="time"]').fill(options.time);
  await modal.getByTestId('event-modal-save-btn').click();

  await expect(modal).not.toBeVisible({ timeout: 10_000 });
}

export async function seedIdeaInDatabase(adminSupabase: SupabaseClient, userId: string, title: string) {
  const { error } = await adminSupabase.from('content_ideas').insert({
    user_id: userId,
    title,
    description: 'Seeded test idea for scheduling flow.',
    status: 'Pending',
    team_id: null,
  });

  if (error) {
    throw new Error(`Failed to seed idea: ${error.message}`);
  }
}
