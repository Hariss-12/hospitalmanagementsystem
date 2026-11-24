/**
 * Frontend Production Build & Source Verification Script (`scripts/build.mjs`)
 *
 * Verifies required React pages, context providers, and components exist,
 * then uses Vite to compile and bundle the production app into `frontend/dist/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const REQUIRED_FILES = [
  'api/axiosClient.js',
  'context/AuthContext.jsx',
  'components/HospitalComponents.jsx',
  'pages/LandingPage.jsx',
  'pages/RegisterPage.jsx',
  'pages/LoginPage.jsx',
  'pages/PatientDashboard.jsx',
  'pages/DoctorDashboard.jsx',
  'pages/AdminDashboard.jsx',
  'pages/DoctorDirectoryPage.jsx',
  'pages/BookAppointmentPage.jsx',
  'pages/RescheduleAppointmentPage.jsx',
  'pages/AppointmentHistoryPage.jsx',
  'pages/DFAVisualizationPage.jsx',
  'pages/ProfileSettingsPage.jsx',
  'pages/UnauthorizedPage.jsx',
  'pages/NotFoundPage.jsx',
  'App.jsx',
  'main.jsx',
];

for (const rel of REQUIRED_FILES) {
  const fullPath = path.join(srcDir, rel);
  if (!fs.existsSync(fullPath)) {
    console.error(`Build Error: Missing required frontend module: ${rel}`);
    process.exit(1);
  }
  const code = fs.readFileSync(fullPath, 'utf8');
  if (code.trim().length < 25) {
    console.error(`Build Error: Module ${rel} is empty or incomplete.`);
    process.exit(1);
  }
}

await build({
  configFile: path.join(rootDir, 'vite.config.js'),
  root: rootDir,
});

console.log(`[Frontend Production Build] Verified ${REQUIRED_FILES.length} modules and built dist/ with Vite.`);
