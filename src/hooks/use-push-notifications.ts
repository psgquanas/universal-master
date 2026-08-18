import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getInstallationId, savePushToken } from '@/lib/push-tokens';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function openNotification(response: Notifications.NotificationResponse | null | undefined) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && /^\/\(chat\)\/[0-9a-f-]+$/i.test(url)) {
    router.push(url as never);
  }
}

async function registerToken(token: string) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  const installationId = await getInstallationId();
  const { error } = await supabase.rpc('register_push_token', {
    push_token: token,
    installation_id: installationId,
    device_platform: Platform.OS,
  });
  if (error) throw error;
  await savePushToken(token);
}

async function registerForPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#4361EE',
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted'
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is missing from the Expo configuration.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerToken(token.data);
}

export function usePushNotifications(userId?: string) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;

    void registerForPushNotifications().catch((error) => {
      console.warn('[notifications] registration failed', error);
    });
    openNotification(Notifications.getLastNotificationResponse());

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void registerToken(token.data).catch((error) => console.warn('[notifications] token refresh failed', error));
    });

    return () => {
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [userId]);
}
