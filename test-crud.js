const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Listen to all console messages and print them to the terminal
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`[BROWSER ${type}] ${msg.text()}`);
    });

    page.on('requestfailed', request => {
        console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });

    try {
        console.log('Navigating to http://localhost:5173');
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

        // Wait a bit to see if there is any redirect (e.g., to login.html)
        await new Promise(r => setTimeout(r, 2000));
        console.log('Current URL after navigation: ', page.url());

        // If at login, try to sign up or log in
        if (page.url().includes('login.html')) {
            console.log('On login page, attempting to register...');
            await page.click('#register-tab');
            await new Promise(r => setTimeout(r, 500));
            await page.type('#registerPane input[name="lawyerName"]', 'Test Lawyer');
            await page.type('#registerPane input[name="email"]', 'test_crud_' + Date.now() + '@test.com');
            await page.type('#registerPane input[name="password"]', 'password123');
            await page.click('#registerPane button[type="submit"]');
            await new Promise(r => setTimeout(r, 3000));
            console.log('Current URL after login attempt: ', page.url());
        }

        if (page.url().includes('dashboard.html')) {
            console.log('On dashboard, navigating to clients...');
            await page.goto('http://localhost:5173/pages/clients.html', { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 2000));
            console.log('Current URL after navigation: ', page.url());

            // Try to add a client via js
            console.log('Attempting to add a client...');
            await page.evaluate(() => {
                const addBtn = document.querySelector('button[data-bs-target="#addClientModal"]');
                if (addBtn) {
                    addBtn.click();
                    setTimeout(() => {
                        document.querySelector('input[name="name"]').value = 'Test Client';
                        document.querySelector('input[name="mobile"]').value = '01234567890';
                        document.querySelector('#addClientForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }, 500);
                }
            });
            await new Promise(r => setTimeout(r, 3000));
        }

    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        console.log('Closing browser...');
        await browser.close();
    }
})();
