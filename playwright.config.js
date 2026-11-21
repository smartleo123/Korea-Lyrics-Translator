import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',
 timeout:30000,
 expect:{timeout:5000},
 retries:0,
 workers:process.env.CI?1:undefined,
 reporter:process.env.CI?'list':'html',
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:{
  command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
  url:'http://127.0.0.1:4173',
  reuseExistingServer:!process.env.CI,
  timeout:30000
 }
});
