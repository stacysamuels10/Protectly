import { test, expect } from '@playwright/test'

test.describe('Dashboard (Unauthenticated)', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should redirect to auth or show login
    // The exact behavior depends on your middleware/auth setup
    await expect(page).not.toHaveURL('/dashboard')
  })

  test('should redirect to login when accessing allowlist without auth', async ({ page }) => {
    await page.goto('/dashboard/allowlist')
    
    await expect(page).not.toHaveURL('/dashboard/allowlist')
  })

  test('should redirect to login when accessing settings without auth', async ({ page }) => {
    await page.goto('/dashboard/settings')
    
    await expect(page).not.toHaveURL('/dashboard/settings')
  })

  test('should redirect to login when accessing activity without auth', async ({ page }) => {
    await page.goto('/dashboard/activity')
    
    await expect(page).not.toHaveURL('/dashboard/activity')
  })
})

test.describe('Dashboard Navigation', () => {
  // These tests would require authentication
  // In a real setup, you'd use a test user or mock authentication
  
  test.skip('should display sidebar with navigation links', async ({ page }) => {
    // This test requires authenticated state
    await page.goto('/dashboard')
    
    // Sidebar navigation
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /allowlist/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /activity/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })

  test.skip('should display welcome message with user name', async ({ page }) => {
    await page.goto('/dashboard')
    
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test.skip('should display stats cards', async ({ page }) => {
    await page.goto('/dashboard')
    
    await expect(page.getByText('Total Bookings')).toBeVisible()
    await expect(page.getByText('Approved')).toBeVisible()
    await expect(page.getByText('Rejected')).toBeVisible()
    await expect(page.getByText('Allowlist Size')).toBeVisible()
  })

  test.skip('should display recent activity section', async ({ page }) => {
    await page.goto('/dashboard')
    
    await expect(page.getByRole('heading', { name: /recent activity/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /view all/i })).toBeVisible()
  })

  test.skip('should navigate to allowlist page', async ({ page }) => {
    await page.goto('/dashboard')
    
    await page.getByRole('link', { name: /allowlist/i }).click()
    
    await expect(page).toHaveURL('/dashboard/allowlist')
  })

  test.skip('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard')
    
    await page.getByRole('link', { name: /settings/i }).click()
    
    await expect(page).toHaveURL('/dashboard/settings')
  })

  test.skip('should navigate to activity page', async ({ page }) => {
    await page.goto('/dashboard')
    
    await page.getByRole('link', { name: /activity/i }).click()
    
    await expect(page).toHaveURL('/dashboard/activity')
  })
})

// Example of how to set up authenticated tests with Playwright
// You would typically set this up in a global setup file or fixture
test.describe('Dashboard with Auth (Example Setup)', () => {
  // To run authenticated tests, you can:
  // 1. Use storageState to persist auth between tests
  // 2. Create a test user in your database
  // 3. Mock the session/auth API
  
  test.skip('Example: How to set up authenticated state', async ({ page, context }) => {
    // Option 1: Set cookies directly
    // await context.addCookies([{
    //   name: 'session',
    //   value: 'your-test-session-token',
    //   domain: 'localhost',
    //   path: '/',
    // }])
    
    // Option 2: Log in through the UI once and save state
    // await page.goto('/api/auth/calendly')
    // ... complete OAuth flow ...
    // await context.storageState({ path: 'playwright/.auth/user.json' })
    
    // Option 3: Use API to create authenticated session
    // await page.request.post('/api/test/create-session', {
    //   data: { email: 'test@example.com' }
    // })
    
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })
})

