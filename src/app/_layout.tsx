import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { RealtimeLifecycle } from "@/components/realtime-lifecycle";
import { AuthProvider, useAuth as useAuthContext } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/theme-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
  useFonts,
} from "@expo-google-fonts/outfit";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import { Stack } from "expo-router/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_100Thin,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <InnerLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}

function InnerLayout() {
  const colorScheme = useColorScheme();
  const { session } = useAuthContext();
  usePushNotifications(session?.user.id);

  return (
    <NavigationThemeProvider
      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RealtimeLifecycle userId={session?.user.id} />
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(auth)">
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Protected guard={Boolean(session)}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="(chat)" />
            <Stack.Screen name="(public)" />
          </Stack.Protected>
        </Stack>
      </GestureHandlerRootView>
    </NavigationThemeProvider>
  );
}
