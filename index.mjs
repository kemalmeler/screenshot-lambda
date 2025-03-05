import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { S3 } from '@aws-sdk/client-s3';

const s3 = new S3();

export const handler = async (event, context) => {
    let browser = null;
    try {
        // Get URL from event or use default
        const url = event.url || 'https://www.tradingview.com/chart/?symbol=BITSTAMP%3ABTCUSD';
        
        // Get custom viewport settings if provided
        const viewport = event.viewport || {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        };

        // Get custom selector to wait for (optional)
        const waitForSelector = event.waitForSelector || '.chart-container';
        
        // Get custom wait time (optional)
        const waitTime = event.waitTime || 20000;

        // Configure Chrome
        const executablePath = await chromium.executablePath();

        console.log('Launching browser...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--deterministic-fetch',
                '--disable-features=IsolateOrigins',
                '--disable-site-isolation-trials',
                '--single-process'
            ],
            defaultViewport: viewport,
            executablePath,
            headless: true,
            ignoreHTTPSErrors: true
        });

        console.log('Creating new page...');
        const page = await browser.newPage();

        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Set viewport
        await page.setViewport(viewport);

        // Set longer timeout for navigation
        page.setDefaultNavigationTimeout(120000);
        page.setDefaultTimeout(120000);

        // Navigate to URL with longer timeout
        console.log(`Navigating to URL: ${url}`);
        const response = await page.goto(url, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 120000
        });

        if (!response.ok()) {
            throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
        }

        // Wait for specified selector with longer timeout
        console.log(`Waiting for selector: ${waitForSelector}`);
        await page.waitForSelector(waitForSelector, { 
            timeout: 120000,
            visible: true 
        });

        // Add configurable delay to ensure content is fully rendered
        console.log(`Waiting for ${waitTime}ms...`);
        await page.waitForTimeout(waitTime);

        // Take screenshot
        console.log('Taking screenshot...');
        const screenshot = await page.screenshot({
            type: 'png',
            fullPage: event.fullPage || false,
            encoding: 'binary',
            captureBeyondViewport: false,
            omitBackground: true
        });

        // Generate filename from URL
        const urlObj = new URL(url);
        const baseFilename = urlObj.hostname.replace(/\./g, '_') + urlObj.pathname.replace(/\W+/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `screenshots/${baseFilename}_${timestamp}.png`;

        // Upload to S3
        console.log('Uploading to S3...');
        await s3.putObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: screenshot,
            ContentType: 'image/png'
        });

        // Close browser properly
        console.log('Closing browser...');
        if (browser !== null) {
            await browser.close();
        }

        // Return only the key
        return key;
    } catch (error) {
        console.error('Detailed error:', error);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        if (browser !== null) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
        throw error; // Hata durumunda hatayı fırlat
    }
}; 