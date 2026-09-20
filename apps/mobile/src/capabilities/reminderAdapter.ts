import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { createReminderAdapter } from './reminderCore';

export const reminderAdapter = createReminderAdapter(
  Notifications as never,
  Platform.OS,
  Date.now,
  Notifications.AndroidImportance.HIGH,
);

