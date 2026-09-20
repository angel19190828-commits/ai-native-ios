const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

function withManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity['meta-data'] = activity['meta-data'] || [];
    if (!activity['meta-data'].some((item) => item.$?.['android:name'] === 'android.app.shortcuts')) {
      activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    }
    activity['intent-filter'] = activity['intent-filter'] || [];
    if (!activity['intent-filter'].some((filter) => filter.action?.some((action) => action.$?.['android:name'] === 'android.intent.action.SEND'))) {
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });
    }
    return mod;
  });
}

function withResources(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    const xmlDir = path.join(res, 'xml');
    const valuesDir = path.join(res, 'values');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.mkdirSync(valuesDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="create_task" android:enabled="true" android:icon="@mipmap/ic_launcher" android:shortcutShortLabel="@string/shortcut_create_task" android:shortcutLongLabel="@string/shortcut_create_task_long">
    <intent android:action="android.intent.action.VIEW" android:data="taskspace://create" />
  </shortcut>
  <shortcut android:shortcutId="continue_task" android:enabled="true" android:icon="@mipmap/ic_launcher" android:shortcutShortLabel="@string/shortcut_continue_task" android:shortcutLongLabel="@string/shortcut_continue_task_long">
    <intent android:action="android.intent.action.VIEW" android:data="taskspace://continue" />
  </shortcut>
</shortcuts>
`);
    fs.writeFileSync(path.join(valuesDir, 'taskspace_shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="shortcut_create_task">Create task</string>
  <string name="shortcut_create_task_long">Create a reviewable Taskspace plan</string>
  <string name="shortcut_continue_task">Continue task</string>
  <string name="shortcut_continue_task_long">Continue the latest Taskspace task</string>
</resources>
`);
    return mod;
  }]);
}

module.exports = function withTaskspaceAndroidIntegrations(config) {
  return withResources(withManifest(config));
};
