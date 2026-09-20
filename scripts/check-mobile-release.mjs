import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const mobile = path.join(root, 'apps', 'mobile');
const app = JSON.parse(fs.readFileSync(path.join(mobile, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync(path.join(mobile, 'eas.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(mobile, 'package.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const staticOnly = args.has('--static');
const profileArg = process.argv.find((value) => value.startsWith('--profile='));
const profile = profileArg?.split('=')[1] ?? 'production';
const failures = [];
const warnings = [];
const passed = [];

function check(condition, label, failure = label) {
  if (condition) passed.push(label); else failures.push(failure);
}

check(/^\d+\.\d+\.\d+$/.test(app.version), 'semantic app version');
check(app.ios?.bundleIdentifier === 'com.ontingyu.taskspace', 'iOS bundle identifier');
check(app.android?.package === 'com.ontingyu.taskspace', 'Android application ID');
check(typeof app.scheme === 'string' && app.scheme.length > 0, 'deep-link scheme');
check(app.ios?.config?.usesNonExemptEncryption === false, 'export compliance declaration');
const plugins = app.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin);
for (const plugin of ['@sentry/react-native/expo', 'expo-calendar', 'expo-secure-store', 'expo-notifications', 'expo-build-properties', './plugins/withTaskspaceAndroidIntegrations']) {
  check(plugins.includes(plugin), `${plugin} config plugin`);
}
check(Boolean(pkg.dependencies['@sentry/react-native']), 'Sentry React Native dependency');
check(Boolean(pkg.dependencies['@noble/ciphers']), 'authenticated device-cache encryption dependency');
check(app.experiments?.inlineModules?.watchedDirectories?.includes('app-intents'), 'iOS App Intents inline module directory');
check(!pkg.dependencies['expo-app-intents'], 'stable Expo SDK dependency alignment', 'expo-app-intents currently targets Expo SDK 58 beta and must not be mixed into the SDK 57 release build');
for (const file of [
  'app-intents/AppIntentsSetup.swift',
  'app-intents/TaskspaceIntents.swift',
  'app-intents/AppShortcuts.swift',
  'plugins/withTaskspaceAndroidIntegrations.js',
  'modules/taskspace-intake/android/src/main/java/expo/modules/taskspaceintake/TaskspaceIntakeModule.kt',
  'metro.config.js',
  'src/observability/monitoring.ts',
  'src/observability/monitoringCore.ts',
  'src/domain/orchestration.ts',
  'src/domain/planCompiler.ts',
  'src/scenarios/invitation.ts',
  'src/scenarios/generic.ts',
  'src/api/orchestratorClient.ts',
]) {
  check(fs.existsSync(path.join(mobile, file)), `${file} exists`);
}
check(Boolean(pkg.dependencies['expo-dev-client']), 'development client dependency');
check(eas.cli?.appVersionSource === 'remote', 'remote build versioning');
for (const name of ['development', 'preview', 'production']) {
  check(eas.build?.[name]?.environment === name, `${name} EAS environment`);
}
check(eas.build?.preview?.distribution === 'internal', 'Android/iOS internal preview profile');
check(eas.build?.production?.autoIncrement === true, 'production build auto-increment');
for (const document of ['MVP_SCOPE.md', 'ARCHITECTURE.md', 'PRIVACY_DATA_MAP.md', 'STORE_LISTING.md', 'DEVICE_QA.md', 'RELEASE_RUNBOOK.md', 'EXPERIENCE_WALKTHROUGH.md']) {
  check(fs.existsSync(path.join(root, 'docs', document)), `${document} exists`);
}
for (const page of ['privacy.html', 'support.html']) {
  check(fs.existsSync(path.join(root, page)), `${page} exists`);
}
for (const workflow of ['mobile-ci.yml', 'eas-internal-build.yml']) {
  check(fs.existsSync(path.join(root, '.github', 'workflows', workflow)), `${workflow} exists`);
}
for (const file of ['api/account.js', 'api/account.test.js', 'api/_capabilities.js', 'api/orchestrate.js', 'api/orchestrate.test.js']) {
  check(fs.existsSync(path.join(root, file)), `${file} exists`);
}

if (!staticOnly) {
  check(/^https:\/\//.test(process.env.EXPO_PUBLIC_API_BASE_URL ?? ''), 'HTTPS public API URL', 'EXPO_PUBLIC_API_BASE_URL must be an HTTPS URL');
  check(/^https:\/\//.test(process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''), 'mobile Supabase URL', 'EXPO_PUBLIC_SUPABASE_URL must be an HTTPS URL');
  check(Boolean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY), 'mobile Supabase publishable key', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
  check(process.env.EXPO_PUBLIC_ALLOW_GUEST !== 'true', 'guest mode disabled', 'EXPO_PUBLIC_ALLOW_GUEST must not be true for release builds');
  check(/^https:\/\//.test(process.env.SUPABASE_URL ?? ''), 'server Supabase URL', 'SUPABASE_URL must be configured for the API deployment');
  check(Boolean(process.env.SUPABASE_PUBLISHABLE_KEY), 'server Supabase publishable key', 'SUPABASE_PUBLISHABLE_KEY is missing for JWT-scoped API access');
  check(Boolean(process.env.SUPABASE_SECRET_KEY), 'server Supabase secret key', 'SUPABASE_SECRET_KEY is missing for authenticated account deletion');
  check(Boolean(process.env.EAS_PROJECT_ID), 'EAS project ID', 'EAS_PROJECT_ID is missing; run eas init or configure the project ID');
  check(/^https:\/\/[^\s@]+@[^\s/]+\/\d+$/.test(process.env.EXPO_PUBLIC_SENTRY_DSN ?? ''), 'Sentry public DSN', 'EXPO_PUBLIC_SENTRY_DSN must be a valid HTTPS ingest DSN');
  check(Boolean(process.env.SENTRY_ORG), 'Sentry organization', 'SENTRY_ORG is missing for source-map upload');
  check(Boolean(process.env.SENTRY_PROJECT), 'Sentry project', 'SENTRY_PROJECT is missing for source-map upload');
  check(Boolean(process.env.SENTRY_AUTH_TOKEN), 'Sentry auth token', 'SENTRY_AUTH_TOKEN is missing for source-map upload');
  check(/^https:\/\//.test(process.env.PRIVACY_POLICY_URL ?? ''), 'privacy policy URL', 'PRIVACY_POLICY_URL must be published over HTTPS');
  check(/^https:\/\//.test(process.env.SUPPORT_URL ?? ''), 'support URL', 'SUPPORT_URL must be published over HTTPS');
  if (profile === 'production') {
    check(Boolean(process.env.APPLE_TEAM_ID), 'Apple team ID', 'APPLE_TEAM_ID is missing');
    check(Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON), 'Google Play service account', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing');
  }
}

if (app.android?.permissions?.includes('SCHEDULE_EXACT_ALARM')) {
  warnings.push('Confirm Play policy eligibility for SCHEDULE_EXACT_ALARM before production submission.');
}

console.log(`Release profile: ${profile}${staticOnly ? ' (static)' : ''}`);
for (const label of passed) console.log(`PASS  ${label}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const failure of failures) console.error(`FAIL  ${failure}`);
if (failures.length) process.exit(1);
