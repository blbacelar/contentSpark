# Test Setup Guide

## Environment Configuration

This project uses environment variables to securely manage test credentials. Follow these steps to set up your test environment:

### 1. Create `.env.test` File

Copy the example file and fill in your actual credentials:

```bash
cp .env.test.example .env.test
```

### 2. Configure Test Credentials

Edit `.env.test` and add your values:

```bash
# Supabase Test Credentials
TEST_SUPABASE_URL=https://your-project.supabase.co
TEST_SUPABASE_KEY=your_supabase_anon_key

# Test User Credentials
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password
```

### 3. Security Notes

- ✅ `.env.test` is already in `.gitignore` and will NOT be committed
- ✅ Use a dedicated test database/project for safety
- ✅ Use a test user account (not your production account)
- ⚠️ Never commit `.env.test` or include credentials in code

### 4. Running Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e.spec.ts

# Run with UI
npx playwright test --ui
```

## Best Practices

1. **Separate Test Environment**: Use a separate Supabase project for tests
2. **Test User Account**: Create a dedicated test user, don't use your personal account
3. **CI/CD**: Set environment variables in your CI/CD platform (GitHub Secrets, etc.)
4. **Never Hardcode**: Always use `process.env.VARIABLE_NAME` for sensitive data

## Troubleshooting

If you see errors about missing environment variables:
1. Verify `.env.test` exists in the project root
2. Check that all required variables are set
3. Restart Playwright if you just created the file
