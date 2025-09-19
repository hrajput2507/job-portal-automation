# Instahyre Auto Apply Bot

An automated job application script for Instahyre using Playwright and TypeScript. This script will automatically apply to all available jobs on your Instahyre dashboard.

## ⚠️ Important Disclaimer

- **Use at your own risk**: This script automates job applications which may violate Instahyre's terms of service
- **Account safety**: Make sure you understand the risks before using this script
- **Manual review recommended**: Consider reviewing jobs before applying

## 🚀 Features

- ✅ Automatic job detection and application
- ✅ Multi-page navigation support
- ✅ Modal handling for application forms
- ✅ Comprehensive error handling and retry logic
- ✅ Detailed logging and progress tracking
- ✅ Application success/failure reporting
- ✅ Configurable delays to avoid detection

## 📋 Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Active Instahyre account (you'll need to be logged in)

## 🛠️ Installation

1. **Clone or download this repository**

   ```bash
   cd "job apply"
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npm run install-browsers
   ```

## 🎯 Usage

### Method 1: Direct Run (Recommended)

```bash
npm start
```

### Method 2: Development Mode

```bash
npm run dev
```

### Method 3: Build and Run

```bash
npm run build
node dist/instahyre-auto-apply.js
```

## 📖 How It Works

1. **Initialization**: Launches a Chromium browser instance
2. **Navigation**: Goes to your Instahyre opportunities page
3. **Login Detection**: Waits for you to log in manually (if not already logged in)
4. **Job Discovery**: Finds all available job cards on the current page
5. **Application Process**:
   - Clicks apply buttons for each job
   - Handles application modals
   - Processes multi-page job listings
6. **Reporting**: Generates a detailed report of all applications

## ⚙️ Configuration

You can modify the script behavior by editing the `instahyre-auto-apply.ts` file:

```typescript
// Browser settings
this.browser = await chromium.launch({
  headless: false, // Set to true for background operation
  slowMo: 1000, // Delay between actions (milliseconds)
});

// Application delays
await this.page.waitForTimeout(2000); // Wait between applications
```

## 📊 Output Example

```
🚀 Initializing Instahyre Auto Apply Bot...
✅ Browser initialized successfully
🌐 Navigating to Instahyre jobs page...
✅ Successfully navigated to jobs page
🔐 Please log in to your Instahyre account manually...
✅ Login detected! Proceeding with job applications...
🔍 Searching for available jobs...
📄 Processing page 1...
🎯 Applying to: Software Engineer at TechCorp
✅ Clicked apply button for: Software Engineer at TechCorp
🎉 Successfully applied to: Software Engineer at TechCorp

📊 APPLICATION REPORT
==================================================
✅ Total Applications: 15
❌ Failed Applications: 2
📈 Success Rate: 88.2%

📋 DETAILED RESULTS:
1. ✅ Software Engineer at TechCorp
2. ✅ Data Scientist at DataCorp
3. ❌ Senior Developer at DevCorp
   Error: No apply button found
...
```

## 🛡️ Safety Features

- **Rate Limiting**: Built-in delays between actions
- **Error Handling**: Graceful handling of failed applications
- **User Agent**: Realistic browser fingerprinting
- **Timeout Protection**: Prevents infinite loops
- **Page Limits**: Maximum 10 pages to prevent excessive requests

## 🔧 Troubleshooting

### Common Issues

1. **"No job cards found"**

   - The website structure may have changed
   - Try running the script again
   - Check if you're on the correct page

2. **"Login timeout"**

   - Make sure you're logged in to Instahyre
   - Refresh the page and try again

3. **"Apply button not found"**
   - Some jobs may not have apply buttons
   - This is normal and will be logged

### Debug Mode

To see more detailed information, you can modify the script to run in non-headless mode:

```typescript
this.browser = await chromium.launch({
  headless: false, // Keep this as false to see the browser
  slowMo: 2000, // Increase delay to see actions clearly
});
```

## 📝 Notes

- The script will wait for you to complete login if needed
- It automatically handles pagination to apply to jobs on multiple pages
- Failed applications are logged but don't stop the process
- The script includes safety limits to prevent excessive API calls

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is licensed under the MIT License.

---

**Happy Job Hunting! 🎯**
