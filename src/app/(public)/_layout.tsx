import { Stack } from 'expo-router/stack';

export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
