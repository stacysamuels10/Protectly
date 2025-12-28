import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the navigation with logo and auth buttons', async ({ page }) => {
    const nav = page.locator('nav')
    
    // Logo
    await expect(nav.getByText('PriCal')).toBeVisible()
    
    // Auth buttons in navigation
    await expect(nav.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Get Started' })).toBeVisible()
  })

  test('should display the hero section with headline and CTA', async ({ page }) => {
    // Main headline
    await expect(
      page.getByRole('heading', { name: /secure your calendly links/i })
    ).toBeVisible()

    // Description
    await expect(
      page.getByText(/automatically cancel meetings/i)
    ).toBeVisible()

    // CTA buttons
    await expect(page.getByRole('button', { name: /get started free/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /learn more/i })).toBeVisible()

    // Free trial text
    await expect(page.getByText(/14-day free trial/i)).toBeVisible()
  })

  test('should display How It Works section with three steps', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /how prical works/i })
    ).toBeVisible()

    // Three step cards
    await expect(page.getByRole('heading', { name: 'Connect' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Authorize' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rest Easy' })).toBeVisible()
  })

  test('should display use cases section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /why people choose prical/i })
    ).toBeVisible()

    // Use case cards
    await expect(page.getByRole('heading', { name: 'Executive Leadership' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Customer Experience' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Education' })).toBeVisible()
  })

  test('should display pricing section with three tiers', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /simple, transparent pricing/i })
    ).toBeVisible()

    // Pricing tiers
    await expect(page.getByText('$0')).toBeVisible()
    await expect(page.getByText('$9')).toBeVisible()
    await expect(page.getByText('$29')).toBeVisible()

    // Plan names
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Business' })).toBeVisible()
  })

  test('should display CTA section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /take the meetings that matter/i })
    ).toBeVisible()

    await expect(
      page.getByRole('button', { name: /start your free trial/i })
    ).toBeVisible()
  })

  test('should display footer with copyright and links', async ({ page }) => {
    const footer = page.locator('footer')
    
    await expect(footer.getByText('PriCal', { exact: true })).toBeVisible()
    await expect(footer.getByText(/© \d{4} PriCal\. All rights reserved\./)).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible()
  })

  test('should navigate to auth when clicking Get Started', async ({ page }) => {
    const getStartedButton = page.getByRole('button', { name: /get started free/i })
    await getStartedButton.click()

    // Should navigate to Calendly OAuth (which then redirects to Calendly login)
    await expect(page).toHaveURL(/calendly\.com|\/api\/auth\/calendly/)
  })

  test('should scroll to How It Works section when clicking Learn More', async ({ page }) => {
    await page.getByRole('button', { name: /learn more/i }).click()

    // The How It Works section should be in view
    const howItWorksSection = page.locator('#how-it-works')
    await expect(howItWorksSection).toBeInViewport()
  })

  test('should have proper page title and meta', async ({ page }) => {
    await expect(page).toHaveTitle(/prical/i)
  })

  test('should be responsive - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Navigation should still be visible
    await expect(page.locator('nav').getByText('PriCal')).toBeVisible()

    // Hero content should be visible
    await expect(
      page.getByRole('heading', { name: /secure your calendly links/i })
    ).toBeVisible()

    // CTA buttons should be visible
    await expect(page.getByRole('button', { name: /get started free/i })).toBeVisible()
  })
})

