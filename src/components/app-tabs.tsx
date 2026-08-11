import { Tabs } from 'expo-router';
import { Bell, CalendarClock, HomeIcon, User } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// ── Tab icon with active pill + primary underline ─────────────────────────────
function TabIcon({
  Icon,
  focused,
  theme,
}: {
  Icon: React.ElementType;
  focused: boolean;
  theme: any;
}) {
  return (
    <View style={styles.iconWrapper}>
      <View style={[styles.pill, focused && { backgroundColor: theme.backgroundSelected }]}>
        <Icon
          size={22}
          strokeWidth={focused ? 2.2 : 1.8}
          color={focused ? theme.text : theme.textSecondary}
        />
        {focused && <View style={[styles.underline, { backgroundColor: theme.primary }]} />}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AppTabs() {
  const theme = useTheme();
  const raw = useColorScheme();
  const scheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';

  const tabBarStyle = {
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.backgroundElement,
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
    paddingHorizontal: 8,
    // Rounded pill shape
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 28 : 12,
    position: 'absolute' as const,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: scheme === 'dark' ? 0.4 : 0.08,
    shadowRadius: 12,
    elevation: 8,
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}>
      {/* Home */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={HomeIcon} focused={focused} theme={theme} />
          ),
        }}
      />

      
      {/* Notifications */}
      <Tabs.Screen
        name="status"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Bell} focused={focused} theme={theme} />
          ),
        }}
      />

      {/* Scheduled messages */}
      <Tabs.Screen
        name="scheduling"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={CalendarClock} focused={focused} theme={theme} />
          ),
        }}
      />

      {/* Find Friends */}
      <Tabs.Screen
        name="Find_friends"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={User} focused={focused} theme={theme} />
          ),
        }}
      />


     
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    width: 52,
    height: 44,
    position: 'relative',
  },
  underline: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
