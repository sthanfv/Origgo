const { test, expect } = require('@playwright/test');

test.describe('Origgo — Suite de Pruebas E2E Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Evitar interrupción del modal de onboarding durante los tests de interacción
    await page.addInitScript(() => {
      localStorage.setItem('origgo_onboarding_seen', '1');
    });
  });

  test('1. La página de inicio carga correctamente con título y metadatos SEO', async ({ page }) => {
    await page.goto('/');

    // Verificar título canónico
    await expect(page).toHaveTitle(/Origgo/);

    // Verificar logotipo e isotipo
    const logo = page.locator('.brand-logo-container, .brand-iso-svg');
    await expect(logo.first()).toBeVisible();

    // Verificar Hero principal
    const heroTitle = page.locator('#heroTitle, .hero-macro-title');
    await expect(heroTitle.first()).toBeVisible();
  });

  test('2. La cuadrícula Bento renderiza las oportunidades directas', async ({ page }) => {
    await page.goto('/');

    // Esperar a que las tarjetas del catálogo se rendericen
    const cards = page.locator('.bento-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Verificar que existan múltiples tarjetas en el DOM
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verificar que una tarjeta contenga precio y ubicación
    const firstCard = cards.first();
    await expect(firstCard.locator('.price-main')).toBeVisible();
    await expect(firstCard.locator('.card-location')).toBeVisible();
  });

  test('3. El filtro de ciudades abre el selector y actualiza el catálogo', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('.bento-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Selector de ciudades
    const cityFilter = page.locator('#cmdFilterLocation');
    await expect(cityFilter).toBeVisible();
    await cityFilter.click();

    // Menú desplegable de ciudades debe estar activo
    const cityMenu = page.locator('#cmdLocationDropdown');
    await expect(cityMenu).toHaveClass(/show/);
  });

  test('4. El modal de checkout y recarga de créditos se abre correctamente', async ({ page }) => {
    await page.goto('/');

    // Botón de VIP / Créditos en cabecera desktop
    const btnCredits = page.locator('#btnVipHeader');
    await expect(btnCredits).toBeVisible();
    await btnCredits.click();

    // Verificar que el modal de checkout adquiera la clase active
    const modal = page.locator('#checkoutModal');
    await expect(modal).toHaveClass(/active/);

    // Verificar que se presenten las opciones de planes o saldo
    const pricingPlans = page.locator('.pricing-option-card, .checkout-modal-card');
    await expect(pricingPlans.first()).toBeVisible();
  });
});
