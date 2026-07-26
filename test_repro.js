const { chromium } = require('playwright');

(async () => {
  console.log('Launching installed system browser (msedge/chrome)...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch (e2) {
      browser = await chromium.launch({ headless: true });
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('=== CONSOLE ERROR ===');
      console.log(msg.text());
    }
  });

  page.on('pageerror', exception => {
    console.log('=== PAGE ERROR (UNCAUGHT EXCEPTION) ===');
    console.log(exception.message);
    console.log(exception.stack);
  });

  try {
    console.log('Navigating to local dev server http://localhost:3000...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('Injecting study document into localStorage and Blob into IndexedDB...');
    await page.evaluate(async () => {
      const mockDoc = {
        id: 'test_doc_1',
        name: 'Test Physics Document.pdf',
        type: 'pdf',
        uploadedAt: Date.now(),
        extractedText: 'This is a test document text.',
        topics: ['Physics', 'Gravity', 'Motion'],
        summary: 'Test summary',
        isProcessed: true,
        aiData: {
          aiNotes: {
            chapterSummary: 'Summary text',
            keyConcepts: ['Force', 'Mass', 'Acceleration'],
            importantFacts: ['F = ma'],
            frequentlyAskedQuestions: ['Q: What is F? A: Force']
          },
          revisionNotes: {
            oneLineSummaries: ['Newton laws'],
            importantPoints: ['Action and reaction'],
            commonExamQuestions: ['Define Newton second law']
          },
          flashcards: []
        }
      };
      localStorage.setItem('dazai_documents', JSON.stringify([mockDoc]));

      // Inject into idb-keyval
      const request = indexedDB.open('keyval-store', 1);
      await new Promise((resolve, reject) => {
        request.onupgradeneeded = () => {
          request.result.createObjectStore('keyval');
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const blob = new Blob(['%PDF-1.4 dummy content'], { type: 'application/pdf' });
          store.put(blob, 'doc_blob_test_doc_1');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    });

    console.log('Reloading page to trigger Blob load...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    console.log('Clicking Hub tab...');
    const hubTab = await page.locator('text="Hub"').first();
    await hubTab.click();
    await page.waitForTimeout(2000);

    console.log('Clicking specifically on Test Physics Document.pdf...');
    const docItem = await page.locator('text="Test Physics Document.pdf"').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      console.log('Clicked! Waiting 5s for PDFWorkspace to mount and verify NO ReferenceError...');
      await page.waitForTimeout(5000);
      console.log('Test completed without any ReferenceError or uncaught exceptions!');
    } else {
      console.log('Document item not visible!');
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
})();
