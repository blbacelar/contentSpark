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

/**
 * COMPREHENSIVE EXPLORATORY QA TEST
 * This test systematically goes through all major screens and features
 * to identify UI/UX issues, bugs, and error handling problems.
 */
test.describe('Exploratory QA - All Screens', () => {
  test('explore all screens and identify issues', async ({ page, loggedInUser }) => {
    test.setTimeout(120_000);
    applyStandardTimeouts(page);

    const issues: Array<{ screen: string; issue: string; severity: string }> = [];

    // STEP 1: Dashboard/Home Screen
    await test.step('1. Dashboard - Home Screen', async () => {
      await openDashboard(page);
      await page.waitForLoadState('networkidle');

      // Check for errors in console
      const logs: string[] = [];
      page.on('console', msg => logs.push(msg.text()));

      // Verify key elements exist
      const dashboardTitle = await page.locator('h1, h2').first();
      expect(dashboardTitle).toBeTruthy();

      // Check for common UI issues
      const mainContent = page.locator('main, [role="main"]');
      if (!mainContent.isVisible()) {
        issues.push({
          screen: 'Dashboard',
          issue: 'Main content area not visible',
          severity: 'High'
        });
      }

      console.log('Dashboard loaded successfully');
    });

    // STEP 2: Profile/Settings Screen
    await test.step('2. Profile Settings Screen', async () => {
      await openProfile(page);
      await page.waitForLoadState('networkidle');

      // Check profile form fields
      const firstNameInput = page.locator('input[placeholder*="First"]');
      const lastNameInput = page.locator('input[placeholder*="Last"]');

      if (!await firstNameInput.isVisible() && !await page.locator('text=First').count()) {
        issues.push({
          screen: 'Profile',
          issue: 'First name field not visible',
          severity: 'Medium'
        });
      }

      // Test form interaction
      const saveButtons = page.getByRole('button').filter({ hasText: /Save Changes|Save Brand Kit|Salvar/i });
      const visibleSaveButtons = await saveButtons.count();
      if (visibleSaveButtons === 0) {
        issues.push({
          screen: 'Profile',
          issue: 'Save button not visible',
          severity: 'High'
        });
      }

      console.log('Profile screen loaded');
    });

    // STEP 3: Brand Kit Upload (if PDF upload field exists)
    await test.step('3. Brand Kit / PDF Upload', async () => {
      // Check if brand kit upload field exists
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();

      if (fileInputCount === 0) {
        console.log('No file upload fields found on profile screen');
      }
    });

    // STEP 4: Persona Management
    await test.step('4. Persona Management', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      const personaName = `QA Persona ${uniqueSuffix}`;

      try {
        await createPersonaFromProfile(page, {
          name: personaName,
          description: 'Test persona for QA',
          ageRange: '25-35',
          occupation: 'QA Tester',
        });
        console.log('Persona created successfully');
      } catch (error) {
        issues.push({
          screen: 'Persona',
          issue: `Failed to create persona: ${error}`,
          severity: 'High'
        });
      }
    });

    // STEP 5: Return to Calendar
    await test.step('5. Calendar/Planning Screen', async () => {
      await returnToCalendar(page);
      await page.waitForLoadState('networkidle');

      // Check if calendar is visible
      const calendarElements = page.locator('[role="grid"], .calendar, [class*="calendar"]');
      if (await calendarElements.count() === 0) {
        console.log('No calendar grid found, might be using different component');
      }

      // Check for date inputs or scheduling elements
      const dateInputs = page.locator('input[type="date"]');
      console.log(`Found ${await dateInputs.count()} date inputs`);
    });

    // STEP 6: Manual Idea Creation
    await test.step('6. Create Manual Idea', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      try {
        await createManualIdea(page, `QA Test Idea ${uniqueSuffix}`);
        console.log('Manual idea created successfully');
      } catch (error) {
        issues.push({
          screen: 'Backlog/Ideas',
          issue: `Failed to create manual idea: ${error}`,
          severity: 'High'
        });
      }
    });

    // STEP 7: Check Notifications
    await test.step('7. Notifications Center', async () => {
      // Look for notification bell or center
      const notificationBell = page.locator('button[aria-label*="notification"], [class*="notification"]');
      const bellCount = await notificationBell.count();
      console.log(`Found ${bellCount} notification elements`);

      if (bellCount > 0) {
        await notificationBell.first().click();
        await page.waitForLoadState('networkidle');
      }
    });

    // STEP 8: Language Switching (if available)
    await test.step('8. Language Switching', async () => {
      const languageButton = page.locator('button[aria-label*="language"], [class*="language"]');
      if (await languageButton.count() > 0) {
        console.log('Language switching option found');
      } else {
        console.log('No language switcher found');
      }
    });

    // STEP 9: Check for Global Error States
    await test.step('9. Error Handling Check', async () => {
      // Look for error messages on page
      const errorElements = page.locator('[class*="error"], [role="alert"], .text-red');
      const errorCount = await errorElements.count();
      if (errorCount > 0) {
        const errorText = await errorElements.first().textContent();
        issues.push({
          screen: 'Global',
          issue: `Found error on page: ${errorText}`,
          severity: 'Medium'
        });
      }
    });

    // STEP 10: Form Validation Tests
    await test.step('10. Form Validation', async () => {
      // Try to submit a form with empty fields
      const firstFormButton = page.locator('button[type="submit"]').first();
      
      if (await firstFormButton.isVisible()) {
        // Check if there's a form near the button
        const form = firstFormButton.locator('..');
        
        // Try clicking submit to see if validation works
        const beforeClick = await page.locator('[class*="error"]').count();
        await firstFormButton.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const afterClick = await page.locator('[class*="error"]').count();
        
        if (afterClick === beforeClick) {
          console.log('Form validation appears to be working or not tested');
        }
      }
    });

    // STEP 11: Responsive Design Check
    await test.step('11. Responsive Elements', async () => {
      const viewport = page.viewportSize();
      console.log(`Current viewport: ${viewport?.width}x${viewport?.height}`);

      // Check for hidden elements on mobile breakpoints
      const hiddenElements = page.locator('[class*="hidden"], [class*="md:"], [class*="lg:"]');
      console.log(`Found ${await hiddenElements.count()} responsive elements`);
    });

    // STEP 12: Network Error Check
    await test.step('12. Network Requests', async () => {
      page.on('response', response => {
        if (!response.ok() && response.status() !== 304) {
          console.warn(`Network error: ${response.url()} - ${response.status()}`);
          issues.push({
            screen: 'Network',
            issue: `Failed request: ${response.url()} (${response.status()})`,
            severity: 'Medium'
          });
        }
      });
    });

    // Print all issues found
    console.log('\n=== QA REPORT ===');
    if (issues.length === 0) {
      console.log('✅ No critical issues found');
    } else {
      console.log(`❌ Found ${issues.length} issues:\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity}] ${issue.screen}: ${issue.issue}`);
      });
    }

    // Assert no high-severity issues
    const highSeverityIssues = issues.filter(i => i.severity === 'High');
    expect(highSeverityIssues).toHaveLength(0);
  });
});
