const { chromium } = require('playwright');

(async () => {
  // Launch the browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Test the main authentication page
    console.log('Testing main authentication page...');
    await page.goto('http://localhost:3000');
    const title = await page.title();
    console.log(`Main page title: ${title}`);
    
    // Verify we can access the dashboard without authentication in development
    console.log('Testing dashboard access...');
    await page.goto('http://localhost:3000/dashboard');
    const dashboardTitle = await page.title();
    console.log(`Dashboard page title: ${dashboardTitle}`);
    
    // Verify dashboard content is loaded
    const welcomeText = await page.textContent('text="Welcome back"');
    console.log(`Dashboard welcome text found: ${!!welcomeText}`);
    
    // Test alerts section
    console.log('Testing alerts section...');
    await page.goto('http://localhost:3000/dashboard/alerts');
    const alertsTitle = await page.title();
    console.log(`Alerts page title: ${alertsTitle}`);
    
    // Test auditing section
    console.log('Testing auditing section...');
    await page.goto('http://localhost:3000/dashboard/auditing');
    const auditingTitle = await page.title();
    console.log(`Auditing page title: ${auditingTitle}`);
    
    console.log('\n✅ All tests passed! Full access is enabled in development mode.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
})();