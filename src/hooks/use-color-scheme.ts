import { useColorScheme as useRNColorScheme } from 'react-native';
import { useContext } from 'react';
import { ThemeContext } from '@/context/theme-context';

/**
 * Custom hook to support manual theme overrides via ThemeContext
 */
export function useColorScheme() {
  const context = useContext(ThemeContext);
  const systemScheme = useRNColorScheme();
  
  if (!context) {
    return systemScheme;
  }

  return context.colorScheme;
}
