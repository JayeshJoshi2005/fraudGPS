import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const python =
  process.platform === 'win32'
    ? '../backend/.venv/Scripts/python.exe'
    : '../backend/.venv/bin/python';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1920, height: 1080 },
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${resolve(python)}" -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8000`,
      url: 'http://127.0.0.1:8000/health',
      timeout: 30000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:3000',
      timeout: 30000,
      reuseExistingServer: false,
    },
  ],
});
