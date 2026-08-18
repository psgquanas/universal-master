import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useRealtimeRecovery(recover: () => void | Promise<void>) {
  const recoverRef = useRef(recover);

  useEffect(() => {
    recoverRef.current = recover;
  }, [recover]);

  useEffect(() => {
    let wasConnected = true;
    const networkSubscription = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      if (connected && !wasConnected) void recoverRef.current();
      wasConnected = connected;
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recoverRef.current();
    });

    return () => {
      networkSubscription();
      appStateSubscription.remove();
    };
  }, []);
}
