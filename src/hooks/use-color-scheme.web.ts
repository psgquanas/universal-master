import { ThemeContext } from '@/context/theme-context';
import { useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const context = useContext(ThemeContext);
  const colorScheme = useRNColorScheme();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setHasHydrated(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  if (context) {
    return context.colorScheme;
  }

  return colorScheme;
}
