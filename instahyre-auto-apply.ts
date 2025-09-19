import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";

interface JobApplicationResult {
  success: boolean;
  jobTitle?: string;
  companyName?: string;
  error?: string;
  timestamp: Date;
}

interface Config {
  credentials: {
    email: string;
    password: string;
  };
  settings: {
    headless: boolean;
    slowMo: number;
    maxPages: number;
    applicationDelay: number;
  };
}

class InstahyreAutoApply {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private results: JobApplicationResult[] = [];
  private appliedCount = 0;
  private failedCount = 0;
  private config: Config;
  private hasClickedView = false;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      const configData = fs.readFileSync("config.json", "utf8");
      return JSON.parse(configData);
    } catch (error) {
      console.error("❌ Error loading config.json:", error);
      throw new Error("Please ensure config.json exists with your credentials");
    }
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Instahyre Auto Apply Bot...");

    this.browser = await chromium.launch({
      channel: "chrome",
      headless: this.config.settings.headless,
      slowMo: this.config.settings.slowMo,
      args: ["--start-maximized"],
    });

    // Create a maximized context; viewport:null means use window size
    this.context = await this.browser.newContext({
      viewport: null,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();

    console.log("✅ Browser initialized successfully");
  }

  async navigateToJobsPage(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("🌐 Navigating to Instahyre jobs page...");

    try {
      await this.page.goto(
        "https://www.instahyre.com/candidate/opportunities/?matching=true",
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );
      console.log("✅ Page loaded, waiting for content...");

      // Wait for either login form or job content
      await Promise.race([
        this.page.waitForSelector('input[type="email"], input[name="email"]', {
          timeout: 10000,
        }),
        this.page.waitForSelector('.opportunity-card, [class*="job"]', {
          timeout: 10000,
        }),
        this.page.waitForTimeout(5000),
      ]).catch(() => {});

      console.log("✅ Successfully navigated to jobs page");
    } catch (error) {
      console.log("⚠️ Navigation timeout, trying alternative approach...");

      // Try without waiting for networkidle
      try {
        await this.page.goto(
          "https://www.instahyre.com/candidate/opportunities/?matching=true",
          {
            waitUntil: "load",
            timeout: 30000,
          }
        );
        await this.page.waitForTimeout(5000);
        console.log("✅ Alternative navigation successful");
      } catch (altError) {
        console.log("❌ Direct navigation failed, trying main page...");

        // Last resort: try main page and navigate manually
        try {
          await this.page.goto("https://www.instahyre.com", {
            waitUntil: "load",
            timeout: 30000,
          });
          await this.page.waitForTimeout(3000);

          // Try to navigate to opportunities from main page
          const opportunitiesLink = await this.page.$(
            'a[href*="opportunities"], a:has-text("Jobs"), a:has-text("Opportunities")'
          );
          if (opportunitiesLink) {
            await opportunitiesLink.click();
            await this.page.waitForTimeout(3000);
            console.log("✅ Navigated to opportunities via main page");
          } else {
            console.log(
              "⚠️ Could not find opportunities link, continuing with current page"
            );
          }
        } catch (finalError) {
          console.log("❌ All navigation attempts failed:", finalError);
          throw new Error("Could not navigate to jobs page");
        }
      }
    }
  }

  async waitForLogin(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("🔐 Attempting automatic login...");

    try {
      // Try to find and fill login form
      await this.page.waitForSelector(
        'input[type="email"], input[name="email"], #email',
        { timeout: 10000 }
      );

      // Fill email
      await this.page.fill(
        'input[type="email"], input[name="email"], #email',
        this.config.credentials.email
      );
      console.log("✅ Email filled");

      // Fill password
      await this.page.fill(
        'input[type="password"], input[name="password"], #password',
        this.config.credentials.password
      );
      console.log("✅ Password filled");

      // Click login button
      await this.page.click(
        'button[type="submit"], .login-btn, button:has-text("Login"), button:has-text("Sign In")'
      );
      console.log("✅ Login button clicked");

      // Wait for login to complete by URL or key elements
      await Promise.race([
        this.page.waitForURL("**/candidate/opportunities/**", {
          timeout: 60000,
        }),
        this.page.waitForSelector("#interested-btn", { timeout: 60000 }),
        this.page.waitForSelector(
          '.opportunity-card, [data-testid="job-card"]',
          { timeout: 60000 }
        ),
      ]).catch(() => {});

      // Ensure we are on opportunities page
      if (!this.page.url().includes("/candidate/opportunities")) {
        await this.navigateToJobsPage();
      }
      console.log(
        "✅ Login successful (detected)! Proceeding with job applications..."
      );
    } catch (error) {
      console.log("⚠️ Automatic login failed. Please log in manually...");
      console.log("⏳ Waiting for you to complete login...");

      // Fallback to manual login
      try {
        await Promise.race([
          this.page.waitForURL("**/candidate/opportunities/**", {
            timeout: 300000,
          }),
          this.page.waitForSelector("#interested-btn", { timeout: 300000 }),
          this.page.waitForSelector(
            '.opportunity-card, [data-testid="job-card"]',
            { timeout: 300000 }
          ),
        ]);
        if (!this.page.url().includes("/candidate/opportunities")) {
          await this.navigateToJobsPage();
        }
        console.log(
          "✅ Manual login detected! Proceeding with job applications..."
        );
      } catch (manualError) {
        console.log(
          "⚠️ Login timeout. Please ensure you are logged in and try again."
        );
        throw new Error(
          "Login timeout - please log in manually and run the script again"
        );
      }
    }
  }

  async findAndApplyToJobs(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("🔍 Searching for available jobs...");

    // Dismiss potential overlays (cookie, onboarding, etc.)
    await this.dismissOverlays();

    // If we landed on dashboard after login, ensure we're on opportunities page
    try {
      const currentUrl = this.page.url();
      if (!currentUrl.includes("/candidate/opportunities")) {
        await this.navigateToJobsPage();
      }
    } catch {}

    // Try opening any primary "View" or interest modal that enables bulk apply
    await this.openOpportunitiesModalIfPresent();

    let hasMoreJobs = true;
    let pageNumber = 1;

    while (hasMoreJobs) {
      console.log(`📄 Processing page ${pageNumber}...`);

      // Wait for jobs to load
      await this.page.waitForTimeout(2000);

      // First, click all visible Apply buttons directly on this page
      await this.processApplyButtonsOnPage();

      // Find all job cards/opportunities
      const jobCards = await this.page.$$(
        '.job-card, .opportunity-card, [data-testid="job-card"], .job-item'
      );

      if (jobCards.length === 0) {
        console.log("❌ No job cards found. Trying alternative selectors...");

        // Try alternative selectors
        const altJobCards = await this.page.$$(
          '.card, .job, .opportunity, [class*="job"], [class*="opportunity"]'
        );
        if (altJobCards.length === 0) {
          console.log(
            "⚠️ No jobs found on this page. Moving to next page or stopping..."
          );
          hasMoreJobs = await this.tryNextPage();
          pageNumber++;
          continue;
        }
      }

      // Process each job card
      for (let i = 0; i < jobCards.length; i++) {
        try {
          await this.applyToJob(jobCards[i], i + 1);
          await this.page.waitForTimeout(this.config.settings.applicationDelay); // Wait between applications
        } catch (error) {
          console.error(`❌ Error applying to job ${i + 1}:`, error);
          this.failedCount++;
        }
      }

      // Try to go to next page
      hasMoreJobs = await this.tryNextPage();
      pageNumber++;

      if (pageNumber > this.config.settings.maxPages) {
        // Safety limit
        console.log(
          `🛑 Reached maximum page limit (${this.config.settings.maxPages}). Stopping...`
        );
        break;
      }
    }
  }

  private async processViewButtonsOnPage(): Promise<number> {
    if (!this.page) return 0;
    let applied = 0;
    try {
      // Loop until no further View buttons can be clicked and no more content loads
      let progressed = true;
      while (progressed) {
        progressed = false;
        const viewLocator = this.page.locator(
          '#interested-btn, button#interested-btn, .button-interested.btn.btn-success, button[ng-click="openApplyModal(opp)"], button:has-text("View")'
        );
        const count = await viewLocator.count();
        if (count > 0) {
          const btn = viewLocator.first();
          try {
            await btn.scrollIntoViewIfNeeded().catch(() => {});
            await btn.click({ timeout: 4000 }).catch(async () => {
              await btn.click({ force: true, timeout: 1500 }).catch(() => {});
            });
            await Promise.race([
              this.page.waitForSelector(
                '.modal, .apply-modal, [role="dialog"]',
                { timeout: 5000 }
              ),
              this.page
                .waitForLoadState("networkidle", { timeout: 5000 })
                .catch(() => {}),
            ]).catch(() => {});

            // Click Apply inside modal if present
            const appliedNow = await this.clickApplyIfPresent();
            if (appliedNow) applied++;

            // Handle optional secondary popup
            await this.handleOptionalSecondaryApply();

            // Close modal if open to continue
            const closeBtn = await this.page.$(
              'button:has-text("Close"), .close, .btn-close, [aria-label="Close"]'
            );
            if (closeBtn) {
              await closeBtn.click().catch(() => {});
            } else {
              await this.page.keyboard.press("Escape").catch(() => {});
            }

            await this.page.waitForTimeout(400);
            progressed = true;
            continue;
          } catch {
            // fall through to scroll
          }
        }

        // Try to reveal more cards by scrolling; break if no movement
        const before = await this.page.evaluate(
          () => (globalThis as any).scrollY
        );
        await this.page.mouse.wheel(0, 1200).catch(() => {});
        await this.page.waitForTimeout(600);
        const after = await this.page.evaluate(
          () => (globalThis as any).scrollY
        );
        if (after !== before) {
          progressed = true;
        }
      }
    } catch {}
    return applied;
  }

  private async processApplyButtonsOnPage(): Promise<number> {
    if (!this.page) return 0;
    let applied = 0;

    console.log("🔍 Looking for View button (first time only)...");

    // First time only: click View button to open job details
    if (!this.hasClickedView) {
      try {
        // Dismiss any blocking overlays before clicking
        await this.dismissOverlays().catch(() => {});
        await this.closeModal().catch(() => {});

        const viewButtons = await this.page.$$(
          'button.button-interested.btn.btn-success, #interested-btn, button:has-text("View")'
        );
        console.log(`🔍 Found ${viewButtons.length} View buttons`);

        if (viewButtons.length > 0) {
          const firstViewBtn = viewButtons[0];
          const isVisible = await firstViewBtn.isVisible();
          const isEnabled = await firstViewBtn.isEnabled();

          if (isVisible && isEnabled) {
            console.log("🎯 Clicking View button (first time only)...");
            try {
              await firstViewBtn.scrollIntoViewIfNeeded();
              await firstViewBtn.click({ timeout: 500 });
            } catch {
              try {
                await firstViewBtn.click({ force: true, timeout: 500 });
              } catch {
                await firstViewBtn.evaluate((el: any) => el.click());
              }
            }
            console.log("✅ Clicked View button (first time)");
            this.hasClickedView = true;
            await this.page.waitForTimeout(500);
          }
        }
      } catch (error) {
        console.log("❌ Failed during View click:", error);
      }
    }

    console.log("🔍 Now clicking Apply buttons recursively...");

    // Keep clicking Apply buttons until no more are found
    let maxAttempts = 50; // Safety limit
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Apply attempt ${attempts}/${maxAttempts}`);

      // Look for Apply buttons and click them
      const foundApply = await this.clickApplyButtonsRecursively();

      if (foundApply) {
        applied++;
      } else {
        console.log("❌ No more Apply buttons found, stopping...");
        break;
      }
    }

    console.log(`📊 Applied to ${applied} jobs total`);
    return applied;
  }

  private async clickApplyButtonsRecursively(): Promise<boolean> {
    if (!this.page) return false;

    // Look for first Apply button (primary)
    const firstApplySelectors = [
      "button.btn.btn-lg.btn-primary.new-btn",
      "button.btn-primary",
      'button:has-text("Apply"):not(.btn-success)',
    ];

    let foundApplyButton = false;
    for (const selector of firstApplySelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();

          if (isVisible && isEnabled) {
            console.log(`🎯 Found first Apply button: ${selector}`);

            // Click first Apply button
            try {
              await btn.scrollIntoViewIfNeeded();
              await btn.click({ timeout: 500 });
              console.log("✅ Clicked first Apply button (normal)");
              foundApplyButton = true;
            } catch (error1) {
              try {
                await btn.click({ force: true, timeout: 500 });
                console.log("✅ Clicked first Apply button (force)");
                foundApplyButton = true;
              } catch (error2) {
                try {
                  await btn.evaluate((el: any) => el.click());
                  console.log("✅ Clicked first Apply button (JavaScript)");
                  foundApplyButton = true;
                } catch (error3) {
                  console.log(
                    `❌ Failed to click first Apply button: ${selector}`
                  );
                  continue;
                }
              }
            }

            // Wait for second Apply button to appear
            console.log("⏳ Waiting for second Apply button...");
            await this.page.waitForTimeout(500);

            // Look for second Apply button
            const secondBtn = await this.page.$(
              'button.btn.btn-lg.btn-success[ng-click="applyBulk()"]'
            );
            if (secondBtn) {
              const secondVisible = await secondBtn.isVisible();
              const secondEnabled = await secondBtn.isEnabled();

              if (secondVisible && secondEnabled) {
                console.log("🎯 Found second Apply button, clicking...");
                try {
                  await secondBtn.click({ timeout: 500 });
                  console.log("✅ Clicked second Apply button (normal)");
                } catch (error) {
                  try {
                    await secondBtn.click({ force: true, timeout: 500 });
                    console.log("✅ Clicked second Apply button (force)");
                  } catch (error2) {
                    await secondBtn.evaluate((el: any) => el.click());
                    console.log("✅ Clicked second Apply button (JavaScript)");
                  }
                }
              } else {
                console.log("⚠️ Second Apply button found but not clickable");
              }
            } else {
              console.log("⚠️ No second Apply button found");
            }

            break;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (!foundApplyButton) {
      console.log("❌ No Apply button found");
      return false;
    }

    // Close any popups or modals that might have appeared
    try {
      const closeBtn = await this.page.$(
        'button:has-text("Close"), .close, .btn-close, [aria-label="Close"]'
      );
      if (closeBtn) {
        await closeBtn.click().catch(() => {});
        console.log("✅ Closed popup/modal");
      }

      // Also try pressing Escape key
      await this.page.keyboard.press("Escape").catch(() => {});
    } catch (error) {
      // Ignore close errors
    }

    // Wait a bit before next iteration
    await this.page.waitForTimeout(100);

    return true; // Successfully found and clicked Apply button
  }

  private async clickApplyButtonInModal(): Promise<boolean> {
    if (!this.page) return false;

    console.log("🔍 Looking for Apply button...");

    // Wait a bit for modal to fully load (reduced)
    await this.page.waitForTimeout(300);

    const applySelectors = [
      "button.btn.btn-lg.btn-primary.new-btn",
      'button[ng-click="applyBulk()"]',
      'button:has-text("Apply")',
      'button:has-text("Submit")',
      ".btn-primary",
      ".submit-btn",
      "button.btn-success",
      "button[class*='apply']",
      "button[class*='submit']",
    ];

    for (const selector of applySelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          console.log(`🎯 Found Apply button: ${selector}`);

          // Check if button is visible and enabled
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();
          console.log(
            `Button state - Visible: ${isVisible}, Enabled: ${isEnabled}`
          );

          if (!isVisible || !isEnabled) {
            console.log(`⚠️ Button not clickable: ${selector}`);
            continue;
          }

          // Try multiple click methods (reduced timeouts)
          try {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ timeout: 2000 });
            console.log("✅ Clicked Apply button (normal)");
            return true;
          } catch (error1) {
            console.log("⚠️ Normal click failed, trying force click...");
            try {
              await btn.click({ force: true, timeout: 1000 });
              console.log("✅ Clicked Apply button (force)");
              return true;
            } catch (error2) {
              console.log("⚠️ Force click failed, trying JavaScript...");
              try {
                await btn.evaluate((el: any) => {
                  el.style.pointerEvents = "auto";
                  el.style.zIndex = "9999";
                  el.click();
                });
                console.log("✅ Clicked Apply button (JavaScript)");
                return true;
              } catch (error3) {
                console.log(`❌ All click methods failed for: ${selector}`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with selector ${selector}:`, error);
      }
    }

    // Last resort: try to find any button with "Apply" text using JavaScript
    console.log("🔍 Trying JavaScript search for Apply button...");
    try {
      const jsClicked = await this.page.evaluate(() => {
        const buttons = (globalThis as any).document.querySelectorAll(
          'button, a, [role="button"]'
        );
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim().toLowerCase();
          if (text.includes("apply") && btn.offsetParent !== null) {
            console.log("Found Apply button via JS:", text);
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (jsClicked) {
        console.log("✅ Clicked Apply button via JavaScript search");
        return true;
      }
    } catch (error) {
      console.log("❌ JavaScript search failed:", error);
    }

    console.log("❌ No Apply button found or clickable");
    return false;
  }

  private async clickSecondApplyButton(): Promise<boolean> {
    if (!this.page) return false;

    console.log("🔍 Looking for second Apply button (bulk apply)...");

    // Wait a bit for the second button to appear
    await this.page.waitForTimeout(1000);

    const secondApplySelectors = [
      'button.btn.btn-lg.btn-success[ng-click="applyBulk()"]',
      'button[ng-click="applyBulk()"]',
      "button.btn.btn-lg.btn-success",
      'button:has-text("Apply"):not(.btn-primary)',
    ];

    for (const selector of secondApplySelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          console.log(`🎯 Found second Apply button: ${selector}`);

          // Check if button is visible and enabled
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();
          console.log(
            `Second button state - Visible: ${isVisible}, Enabled: ${isEnabled}`
          );

          if (!isVisible || !isEnabled) {
            console.log(`⚠️ Second button not clickable: ${selector}`);
            continue;
          }

          // Try to click the second button
          try {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ timeout: 2000 });
            console.log("✅ Clicked second Apply button (normal)");
            return true;
          } catch (error1) {
            try {
              await btn.click({ force: true, timeout: 1000 });
              console.log("✅ Clicked second Apply button (force)");
              return true;
            } catch (error2) {
              try {
                await btn.evaluate((el: any) => {
                  el.style.pointerEvents = "auto";
                  el.style.zIndex = "9999";
                  el.click();
                });
                console.log("✅ Clicked second Apply button (JavaScript)");
                return true;
              } catch (error3) {
                console.log(
                  `❌ All click methods failed for second button: ${selector}`
                );
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with second button selector ${selector}:`, error);
      }
    }

    // JavaScript fallback for second button
    try {
      const jsClicked = await this.page.evaluate(() => {
        const buttons = (globalThis as any).document.querySelectorAll("button");
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim().toLowerCase();
          const classes = (btn.className || "").toLowerCase();
          const ngClick = (btn.getAttribute("ng-click") || "").toLowerCase();

          if (
            (text.includes("apply") && classes.includes("btn-success")) ||
            ngClick.includes("applybulk")
          ) {
            console.log(
              "Found second Apply button via JS:",
              text,
              classes,
              ngClick
            );
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (jsClicked) {
        console.log("✅ Clicked second Apply button via JavaScript search");
        return true;
      }
    } catch (error) {
      console.log("❌ JavaScript search for second button failed:", error);
    }

    console.log("⚠️ No second Apply button found");
    return false;
  }

  private async closeModal(): Promise<void> {
    if (!this.page) return;

    const closeSelectors = [
      'button:has-text("Close")',
      ".close",
      ".btn-close",
      '[aria-label="Close"]',
      ".modal-close",
    ];

    for (const selector of closeSelectors) {
      const closeBtn = await this.page.$(selector);
      if (closeBtn) {
        await closeBtn.click().catch(() => {});
        return;
      }
    }

    // Fallback to Escape key
    await this.page.keyboard.press("Escape").catch(() => {});
  }

  private async dismissOverlays(): Promise<void> {
    if (!this.page) return;
    const dismissSelectors = [
      'button:has-text("Got it")',
      'button:has-text("Accept")',
      'button:has-text("I agree")',
      ".cookie-consent-accept",
      "#onetrust-accept-btn-handler",
      ".ot-pc-refuse-all-handler",
    ];
    for (const sel of dismissSelectors) {
      try {
        const btn = await this.page.$(sel);
        if (btn) {
          await btn.click({ timeout: 1000 }).catch(() => {});
          await this.page.waitForTimeout(300);
        }
      } catch {}
    }
  }

  private async openOpportunitiesModalIfPresent(): Promise<void> {
    if (!this.page) return;
    try {
      const viewSelectors = [
        "#interested-btn",
        'button:has-text("View")',
        'a:has-text("View")',
        'button:has-text("See more")',
      ];
      for (const selector of viewSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          // Wait for modal or possible navigation to details
          await Promise.race([
            this.page.waitForSelector('.modal, .apply-modal, [role="dialog"]', {
              timeout: 5000,
            }),
            this.page
              .waitForLoadState("networkidle", { timeout: 5000 })
              .catch(() => {}),
          ]).catch(() => {});

          // Try direct apply first
          await this.clickApplyIfPresent();

          // If a bulk apply button exists in modal, click it
          const bulkSelectors = [
            'button:has-text("Apply All")',
            "button.btn-success",
            'button[ng-click="applyBulk()"]',
          ];
          for (const bSel of bulkSelectors) {
            const bulkBtn = await this.page.$(bSel);
            if (bulkBtn) {
              await bulkBtn.click();
              await this.page.waitForTimeout(1500);
              break;
            }
          }
          break;
        }
      }
    } catch {
      // ignore if not present
    }
  }

  private async applyToJob(jobCard: any, jobIndex: number): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      // Ensure the card is in view
      try {
        await jobCard.scrollIntoViewIfNeeded();
      } catch {}

      // Get job title for logging
      const jobTitle = await jobCard
        .$eval(
          'h3, h4, .job-title, .title, [class*="title"]',
          (el: any) => el?.textContent?.trim() || "Unknown Job"
        )
        .catch(() => "Unknown Job");

      const companyName = await jobCard
        .$eval(
          '.company, .company-name, [class*="company"]',
          (el: any) => el?.textContent?.trim() || "Unknown Company"
        )
        .catch(() => "Unknown Company");

      console.log(`🎯 Applying to: ${jobTitle} at ${companyName}`);

      // If there's a "View" button, click it first to open details/modal
      try {
        const viewLocator = jobCard.locator(
          '#interested-btn, button#interested-btn, .button-interested.btn.btn-success, button[ng-click="openApplyModal(opp)"], button:has-text("View"), a:has-text("View")'
        );
        const count = await viewLocator.count();
        if (count > 0) {
          const viewBtn = viewLocator.first();
          await viewBtn.scrollIntoViewIfNeeded().catch(() => {});
          await viewBtn
            .waitFor({ state: "visible", timeout: 3000 })
            .catch(() => {});
          await viewBtn.click({ timeout: 5000 }).catch(async () => {
            // Try force and retry
            await viewBtn.click({ force: true, timeout: 2000 }).catch(() => {});
          });
          await this.page.waitForTimeout(500);
        }
      } catch {}

      // Look for apply/interest button within the opened context (modal/details) or card
      let applyButton = await this.page.$(
        'button[ng-click="applyBulk()"], button:has-text("Apply All"), button.apply, .apply-btn, .btn-apply, button:has-text("Apply"), button:has-text("Interested"), [class*="apply"]'
      );
      if (!applyButton) {
        applyButton = await jobCard.$(
          'button[ng-click="applyBulk()"], button:has-text("Apply All"), .apply-btn, .btn-apply, button:has-text("Apply"), button:has-text("Interested"), [class*="apply"]'
        );
      }

      if (!applyButton) {
        console.log(`⚠️ No apply button found for job: ${jobTitle}`);
        this.results.push({
          success: false,
          jobTitle,
          companyName,
          error: "No apply button found",
          timestamp: new Date(),
        });
        return;
      }

      // Click the apply button
      await applyButton.scrollIntoViewIfNeeded().catch(() => {});
      await applyButton
        .waitForElementState("stable", { timeout: 2000 })
        .catch(() => {});
      await applyButton.click({ timeout: 8000 }).catch(async () => {
        await applyButton.click({ force: true, timeout: 2000 }).catch(() => {});
      });
      console.log(`✅ Clicked apply button for: ${jobTitle}`);

      // Wait for modal or page to load
      await this.page.waitForTimeout(2000);

      // Optional: a second popup Apply may appear; handle it
      await this.handleOptionalSecondaryApply();

      // Handle modal if it appears
      await this.handleApplicationModal();

      // Some flows toggle to "Interested" state without modal; add brief wait
      await this.page.waitForTimeout(500);

      this.appliedCount++;
      this.results.push({
        success: true,
        jobTitle,
        companyName,
        timestamp: new Date(),
      });

      console.log(`🎉 Successfully applied to: ${jobTitle} at ${companyName}`);
    } catch (error) {
      console.error(`❌ Failed to apply to job ${jobIndex}:`, error);
      this.results.push({
        success: false,
        jobTitle: `Job ${jobIndex}`,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });
      this.failedCount++;
    }
  }

  private async handleApplicationModal(): Promise<void> {
    if (!this.page) return;

    try {
      // Look for common modal patterns
      const modalSelectors = [
        ".modal",
        ".popup",
        ".dialog",
        '[role="dialog"]',
        ".application-modal",
        ".apply-modal",
      ];

      for (const selector of modalSelectors) {
        const modal = await this.page.$(selector);
        if (modal) {
          console.log("📋 Application modal detected, handling...");

          // Target your specific Apply button first
          let clickedInModal = false;

          // Try your exact button with multiple strategies
          const exactApplyBtn = await modal.$(
            "button.btn.btn-lg.btn-primary.new-btn"
          );
          if (exactApplyBtn) {
            console.log("🎯 Found exact Apply button, attempting click...");

            // Wait for button to be ready and check if it's clickable
            await this.page.waitForTimeout(1000);
            const isClickable = await exactApplyBtn.isEnabled();
            const isVisible = await exactApplyBtn.isVisible();
            console.log(
              `Button state - Clickable: ${isClickable}, Visible: ${isVisible}`
            );

            if (isClickable && isVisible) {
              // Strategy 1: Normal click
              try {
                await exactApplyBtn.scrollIntoViewIfNeeded();
                await exactApplyBtn.click({ timeout: 5000 });
                console.log("✅ Clicked Apply button (normal)");
                clickedInModal = true;
              } catch (error1) {
                console.log("⚠️ Normal click failed, trying force click...");

                // Strategy 2: Force click
                try {
                  await exactApplyBtn.click({ force: true, timeout: 3000 });
                  console.log("✅ Clicked Apply button (force)");
                  clickedInModal = true;
                } catch (error2) {
                  console.log(
                    "⚠️ Force click failed, trying JavaScript click..."
                  );

                  // Strategy 3: JavaScript evaluation with multiple events
                  try {
                    await exactApplyBtn.evaluate((el: any) => {
                      // Try multiple event types
                      el.click();
                      el.dispatchEvent(new Event("click", { bubbles: true }));
                      el.dispatchEvent(
                        new Event("mousedown", { bubbles: true })
                      );
                      el.dispatchEvent(new Event("mouseup", { bubbles: true }));
                      // Try Angular-specific events
                      el.dispatchEvent(
                        new Event("ng-click", { bubbles: true })
                      );
                    });
                    console.log("✅ Clicked Apply button (JavaScript)");
                    clickedInModal = true;
                  } catch (error3) {
                    console.log(
                      "⚠️ JavaScript click failed, trying direct DOM..."
                    );

                    // Strategy 4: Direct DOM manipulation
                    try {
                      await this.page.evaluate(() => {
                        const btn = (globalThis as any).document.querySelector(
                          "button.btn.btn-lg.btn-primary.new-btn"
                        );
                        if (btn) {
                          btn.style.pointerEvents = "auto";
                          btn.style.zIndex = "9999";
                          (btn as any).click();
                        }
                      });
                      console.log("✅ Clicked Apply button (DOM)");
                      clickedInModal = true;
                    } catch (error4) {
                      console.log(
                        "❌ All click strategies failed for Apply button"
                      );
                    }
                  }
                }
              }
            } else {
              console.log("❌ Apply button is not clickable or visible");
            }
          }

          // Fallback to other Apply buttons if exact one not found
          if (!clickedInModal) {
            const fallbackSelectors = [
              'button[ng-click="applyBulk()"]',
              'button:has-text("Apply")',
              'button:has-text("Submit")',
              ".btn-primary",
              ".submit-btn",
            ];

            for (const sel of fallbackSelectors) {
              const btn = await modal.$(sel);
              if (btn) {
                try {
                  await btn.click({ timeout: 4000 });
                  console.log("✅ Clicked fallback Apply button");
                  clickedInModal = true;
                  break;
                } catch {
                  try {
                    await btn.click({ force: true, timeout: 1500 });
                    console.log("✅ Clicked fallback Apply button (force)");
                    clickedInModal = true;
                    break;
                  } catch {
                    // Continue to next selector
                  }
                }
              }
            }
          }

          // If still no click, try JavaScript evaluation on the page
          if (!clickedInModal) {
            await this.page
              .evaluate(() => {
                const selectors = [
                  "button.btn.btn-lg.btn-primary.new-btn",
                  'button[ng-click="applyBulk()"]',
                  'button:has-text("Apply")',
                  'button:has-text("Submit")',
                  ".btn-primary",
                  ".submit-btn",
                ];
                for (const sel of selectors) {
                  const btn = (globalThis as any).document.querySelector(sel);
                  if (btn && !btn.disabled) {
                    (btn as any).click();
                    return true;
                  }
                }
                return false;
              })
              .catch(() => {});
          }

          if (!clickedInModal) {
            // Try general apply buttons inside modal
            await this.clickApplyIfPresent(modal);
          }

          // Handle "Apply similar jobs" popup bulk button if it appears
          const bulkApplyInModal = await modal.$(
            'button.btn.btn-lg.btn-success, button[ng-click="applyBulk()"]'
          );
          if (bulkApplyInModal) {
            try {
              await bulkApplyInModal.click({ timeout: 4000 });
              console.log("✅ Clicked bulk Apply in modal");
              await this.page.waitForTimeout(1200);
            } catch {}
          }

          // Close modal if needed
          const closeButton = await modal.$(
            'button:has-text("Close"), .close, .btn-close, [aria-label="Close"]'
          );
          if (closeButton) {
            await closeButton.click();
            console.log("❌ Closed modal");
          }

          break;
        }
      }

      // Also attempt global Apply button if modal-specific failed
      const globalApply = await this.page.$(
        "button.btn.btn-lg.btn-primary.new-btn"
      );
      if (globalApply) {
        await globalApply.click().catch(() => {});
        console.log("✅ Clicked global Apply button");
        await this.page.waitForTimeout(1000);
      }

      // Also attempt global bulk-apply button from the popup if present
      const globalBulk = await this.page.$(
        'button.btn.btn-lg.btn-success, button[ng-click="applyBulk()"]'
      );
      if (globalBulk) {
        await globalBulk.click().catch(() => {});
        console.log("✅ Clicked global bulk Apply button");
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log("⚠️ Error handling modal:", error);
    }
  }

  private async clickApplyIfPresent(scope?: any): Promise<boolean> {
    if (!this.page) return false;
    const root = scope ?? this.page;
    const selectors = [
      "button.btn.btn-lg.btn-primary.new-btn",
      "button.btn.btn-lg.btn-success",
      'button[ng-click="applyBulk()"]',
      'button:has-text("Apply")',
      'button:has-text("Interested")',
      ".apply-btn",
      ".btn-apply",
      '[class*="apply"] button',
    ];
    for (const sel of selectors) {
      try {
        const btn = await root.$(sel);
        if (btn) {
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await btn.click({ timeout: 4000 }).catch(async () => {
            await btn.click({ force: true, timeout: 1500 }).catch(() => {});
          });
          await this.page.waitForTimeout(800);
          return true;
        }
      } catch {}
    }
    return false;
  }

  private async handleOptionalSecondaryApply(): Promise<void> {
    if (!this.page) return;
    try {
      const appeared = await Promise.race([
        this.page
          .waitForSelector(
            '.modal .btn.btn-lg.btn-success, .apply-modal .btn.btn-lg.btn-success, button[ng-click="applyBulk()"]',
            { timeout: 2500 }
          )
          .then(() => true)
          .catch(() => false),
        this.page.waitForTimeout(2500).then(() => false),
      ]);
      if (appeared) {
        const sec = await this.page.$(
          'button[ng-click="applyBulk()"], .modal .btn.btn-lg.btn-success, .apply-modal .btn.btn-lg.btn-success'
        );
        if (sec) {
          await sec.click().catch(() => {});
          console.log("✅ Clicked secondary Apply (popup)");
          await this.page.waitForTimeout(800);
        }
      }
    } catch {}
  }

  private async tryNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Look for next page button
      const nextButtonSelectors = [
        'button:has-text("Next")',
        'a:has-text("Next")',
        ".next",
        ".pagination-next",
        '[aria-label="Next"]',
        ".page-next",
      ];

      for (const selector of nextButtonSelectors) {
        const nextButton = await this.page.$(selector);
        if (nextButton && (await nextButton.isEnabled())) {
          await nextButton.click();
          console.log("➡️ Navigated to next page");
          await this.page.waitForTimeout(3000);
          return true;
        }
      }

      console.log("📄 No more pages found");
      return false;
    } catch (error) {
      console.log("⚠️ Error navigating to next page:", error);
      return false;
    }
  }

  async generateReport(): Promise<void> {
    console.log("\n📊 APPLICATION REPORT");
    console.log("=".repeat(50));
    console.log(`✅ Total Applications: ${this.appliedCount}`);
    console.log(`❌ Failed Applications: ${this.failedCount}`);
    console.log(
      `📈 Success Rate: ${
        this.appliedCount > 0
          ? (
              (this.appliedCount / (this.appliedCount + this.failedCount)) *
              100
            ).toFixed(1)
          : 0
      }%`
    );

    console.log("\n📋 DETAILED RESULTS:");
    this.results.forEach((result, index) => {
      const status = result.success ? "✅" : "❌";
      const jobInfo = result.jobTitle
        ? `${result.jobTitle} at ${result.companyName}`
        : "Unknown Job";
      console.log(`${index + 1}. ${status} ${jobInfo}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("\n🎉 Auto-apply process completed!");
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close();
      console.log("🧹 Browser closed");
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      await this.navigateToJobsPage();
      await this.waitForLogin();
      await this.findAndApplyToJobs();
      await this.generateReport();
    } catch (error) {
      console.error("💥 Fatal error:", error);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  console.log("🎯 Instahyre Auto Apply Bot Starting...");
  console.log(
    "📝 Make sure you are logged in to Instahyre before running this script"
  );
  console.log("⏰ The script will wait for you to complete login if needed\n");

  const bot = new InstahyreAutoApply();
  await bot.run();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { InstahyreAutoApply };
