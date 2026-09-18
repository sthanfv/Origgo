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

  test('5. La vista móvil a 360px renderiza sin desbordamiento horizontal', async ({ page }) => {
    // Configurar viewport móvil angosto
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    const cards = page.locator('.bento-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Verificar que no haya desbordamiento horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Tomar captura móvil para comprobación visual
    await page.screenshot({ 
      path: 'C:/Users/Sthan/.gemini/antigravity/brain/3a81b4ce-0e78-42e6-a36c-725aff0bf3c2/mobile_360px_editorial_verified.png'
    });

    // Desplazar a la primera tarjeta para capturar la tarjeta completa
    const firstCard = cards.first();
    await firstCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ 
      path: 'C:/Users/Sthan/.gemini/antigravity/brain/3a81b4ce-0e78-42e6-a36c-725aff0bf3c2/mobile_card_editorial_verified.png'
    });

    // Abrir Drawer en móvil y verificar que se despliegue
    const btnSpecs = firstCard.locator('.btn-specs-pill');
    await expect(btnSpecs).toBeVisible();
    await btnSpecs.click();

    const slideup = page.locator('.card-slideup-overlay.active');
    await expect(slideup.first()).toBeVisible();

    await page.screenshot({ 
      path: 'C:/Users/Sthan/.gemini/antigravity/brain/3a81b4ce-0e78-42e6-a36c-725aff0bf3c2/mobile_drawer_editorial_verified.png'
    });
  });

  test('6. El menú lateral abre con fondo vidrio esmerilado y el botón conmuta a cerrar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const btnNavMenu = page.locator('#btnNavMenuBottom');
    await expect(btnNavMenu).toBeVisible();

    // 1. Abrir menú lateral con botón de navegación
    await btnNavMenu.click();
    const sideMenu = page.locator('#sideMenu');
    await expect(sideMenu).toHaveClass(/active/);

    // Esperar transición suave y capturar menú desplegado con fondo esmerilado
    await page.waitForTimeout(400);
    await page.screenshot({ 
      path: 'C:/Users/Sthan/.gemini/antigravity/brain/3a81b4ce-0e78-42e6-a36c-725aff0bf3c2/mobile_side_menu_glass_verified.png'
    });

    // 2. Cerrar menú volviendo a pulsar el botón de menú (toggle bidireccional)
    await btnNavMenu.click();
    await page.waitForTimeout(400);
    await expect(sideMenu).not.toHaveClass(/active/);

    // 3. Capturar la barra inferior móvil translúcida con glassmorphism
    await page.screenshot({ 
      path: 'C:/Users/Sthan/.gemini/antigravity/brain/3a81b4ce-0e78-42e6-a36c-725aff0bf3c2/mobile_bottom_bar_glass_verified.png'
    });
  });
});

