/**
 * profile.tsx — "Orbit" profile screen
 * ────────────────────────────────────────────────────────────────
 * Redesign concept: the app is literally called Orbit, so the
 * avatar cluster becomes a real orbit — three satellites revolve
 * continuously around a still center avatar, with a soft presence
 * ring pulsing behind it. That's the one bold, signature motion.
 * Everything else (metrics, settings, invite banner) stays quiet,
 * airy, and premium: soft gradient sheen, thin dividers instead of
 * boxed-in cards, and accent colors pulled from the same three
 * orbit hues so the palette reads as one system, not decoration.
 *
 * New dependency: expo-linear-gradient (already present in most
 * Expo projects — install with `npx expo install expo-linear-gradient`
 * if you don't have it yet).
 * ──────────────────────────────────────────────────────────────── */

import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight, Edit3, HelpCircle, KeyRound, LockKeyhole, LogOut, Moon, Sun, UserPlus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GradientWrapper } from '@/components/gradient-wrapper';
import { BottomTabInset, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useThemeContext } from '@/context/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentProfile, ProfileRecord } from '@/lib/profile';

// The three orbit hues double as satellite colors AND settings-row
// accents, so the whole screen reads as one connected system.
const ORBIT_COLORS = ['#4361EE', '#7955D9', '#3C9CA2'];

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colorScheme, setTheme } = useThemeContext();
  const { signOut } = useAuth();
  const dark = colorScheme === 'dark';
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/(auth)');
    } catch (error) {
      console.warn('[public profile] logout failed', error);
      Alert.alert('Could not log out', 'Please try again in a moment.');
      setLoggingOut(false);
    }
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    getCurrentProfile()
      .then((currentProfile) => { if (active) setProfile(currentProfile); })
      .catch((error) => console.warn('[public profile] could not refresh profile', error));
    return () => { active = false; };
  }, []));

  const rows = [
    { icon: KeyRound, title: 'Account & identity', sub: 'Verified phone and account security', route: '/(public)/setting_account' as const },
    { icon: LockKeyhole, title: 'Privacy studio', sub: 'Visibility and message controls', route: '/(public)/setting_privacy' as const },
    { icon: Bell, title: 'Notifications', sub: 'Moments worth interrupting for', route: '/(public)/setting_notification' as const },
    { icon: HelpCircle, title: 'Help & feedback', sub: 'Support and product notes', route: '/(public)/setting_help' as const },
  ];

  const details = [
    { value: profile?.email || 'Not set', label: 'email' },
    { value: profile?.phone || 'Not set', label: profile?.phone_verified_at ? 'verified phone' : 'phone' },
    { value: profile?.gender || 'Not set', label: 'gender' },
  ];

  // ── Motion: one entrance, one continuous orbit, one presence pulse ──
  const [contentAnim] = useState(() => new Animated.Value(0));
  const [orbitSpin] = useState(() => new Animated.Value(0));
  const [presencePulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const currentProfile = await getCurrentProfile();
        if (active) {
          setProfile(currentProfile);
        }
      } catch (error) {
        console.warn('[public profile] could not load profile', error);
      }
    };

    loadProfile();

    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const spinLoop = Animated.loop(
      Animated.timing(orbitSpin, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(presencePulse, { toValue: 1, duration: 1700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(presencePulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    pulseLoop.start();

    return () => {
      active = false;
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [contentAnim, orbitSpin, presencePulse]);

  const contentOpacity = contentAnim;
  const contentTranslate = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const spinDeg = orbitSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = presencePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const pulseOpacity = presencePulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const displayName = profile?.full_name?.trim() || 'Your profile';
  const handleText = profile?.username ? `@${profile.username}` : '@yourprofile';
  const bioText = profile?.bio_status || 'A short intro will appear here.';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'U';

  // Fixed satellite positions around a 120×120 cluster, spun as a group
  const ORBIT_RADIUS = 47;
  const satellites = ORBIT_COLORS.map((color, i) => {
    const angle = ((i * 120 + 30) * Math.PI) / 180;
    return {
      color,
      x: 60 + ORBIT_RADIUS * Math.cos(angle) - 8,
      y: 60 + ORBIT_RADIUS * Math.sin(angle) - 8,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>Profile Settings</Text>
              <Text style={[styles.title, { color: theme.text }]}>You</Text>
            </View>
            <TouchableOpacity
              style={[styles.themeButton, { backgroundColor: theme.backgroundElement, shadowColor: theme.primary }]}
              onPress={() => setTheme(dark ? 'light' : 'dark')}
              activeOpacity={0.75}
            >
              {dark ? <Sun size={19} color={theme.primary} /> : <Moon size={19} color={theme.primary} />}
            </TouchableOpacity>
          </View>

          {/* ── Profile card ── */}
          <GradientWrapper
            colors={[hexToRgba(theme.primary, dark ? 0.16 : 0.1), theme.backgroundElement]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.avatarCluster}>
              {/* Presence pulse ring */}
              <Animated.View
                style={[
                  styles.presenceRing,
                  { borderColor: theme.primary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                ]}
              />
              {/* Revolving satellites — spins as one group */}
              <Animated.View style={[styles.orbitField, { transform: [{ rotate: spinDeg }] }]}>
                {satellites.map((s, i) => (
                  <View
                    key={i}
                    style={[styles.satellite, { backgroundColor: s.color, left: s.x, top: s.y }]}
                  />
                ))}
              </Animated.View>
              {/* Still center avatar */}
              <View style={[styles.mainAvatar, { backgroundColor: theme.primary, borderColor: theme.backgroundElement }]}>
                {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.mainAvatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
              </View>
            </View>

            <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
            <Text style={[styles.handle, { color: theme.textSecondary }]}>{handleText} · {bioText}</Text>

            <TouchableOpacity style={[styles.edit, { backgroundColor: theme.backgroundSelected }]} activeOpacity={0.75} onPress={() => router.push({ pathname: '/(auth)/profile', params: { mode: 'edit' } })}>
              <Edit3 size={16} color={theme.primary} />
              <Text style={[styles.editText, { color: theme.primary }]}>Edit your space</Text>
            </TouchableOpacity>
          </GradientWrapper>

          {/* ── Metrics — one card, thin dividers, no boxiness ── */}
          <View style={[styles.metricsCard, { backgroundColor: theme.backgroundElement }]}>
            {details.map((m, i) => (
              <React.Fragment key={m.label}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: theme.text }]}>{m.value}</Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{m.label}</Text>
                </View>
                {i < details.length - 1 && <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />}
              </React.Fragment>
            ))}
          </View>

          {/* ── Settings ── */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>
          <View style={[styles.settings, { backgroundColor: theme.backgroundElement }]}>
            {rows.map(({ icon: Icon, title, sub, route }, i) => {
              const accent = ORBIT_COLORS[i % ORBIT_COLORS.length];
              return (
                <TouchableOpacity
                  key={title}
                  style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected }]}
                  onPress={() => router.push(route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIcon, { backgroundColor: hexToRgba(accent, dark ? 0.22 : 0.14) }]}>
                    <Icon size={18} color={accent} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{sub}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Invite ── */}
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(public)/setting_invite_friend')}>
            <GradientWrapper
              colors={[hexToRgba(theme.primary, dark ? 0.24 : 0.14), hexToRgba(theme.primary, 0.02)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.invite, { borderColor: hexToRgba(theme.primary, 0.3) }]}
            >
              <UserPlus size={18} color={theme.primary} />
              <Text style={[styles.inviteText, { color: theme.primary }]}>Invite someone to Orbit</Text>
              <ChevronRight size={18} color={theme.primary} />
            </GradientWrapper>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: '#EF444455', backgroundColor: hexToRgba('#EF4444', dark ? 0.12 : 0.07) }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.75}
          >
            {loggingOut ? <ActivityIndicator size="small" color="#EF4444" /> : <LogOut size={19} color="#EF4444" />}
            <Text style={styles.logoutText}>{loggingOut ? 'Logging out...' : 'Log out'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 44, paddingBottom: BottomTabInset + 32 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: Fonts?.sansBold, fontSize: 10, letterSpacing: 2.2 },
  title: { fontFamily: Fonts?.sansExtraBold, fontSize: 35, letterSpacing: -1.2, marginTop: 2 },
  themeButton: {
    width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },

  profileCard: { borderRadius: 26, marginTop: 24, padding: 24, alignItems: 'center', overflow: 'hidden' },
  avatarCluster: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  presenceRing: {
    position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1.5,
  },
  orbitField: { ...StyleSheet.absoluteFill },
  satellite: { position: 'absolute', width: 16, height: 16, borderRadius: 6, opacity: 0.9 },
  mainAvatar: {
    width: 76, height: 76, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 4, overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontFamily: Fonts?.sansExtraBold, fontSize: 23 },
  mainAvatarImage: { width: '100%', height: '100%' },

  name: { fontFamily: Fonts?.sansBold, fontSize: 21, marginTop: 14 },
  handle: { fontFamily: Fonts?.sans, fontSize: 13, marginTop: 4 },
  edit: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18,
    borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10,
  },
  editText: { fontFamily: Fonts?.sansSemiBold, fontSize: 13 },

  metricsCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20, marginTop: 14, paddingVertical: 18,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontFamily: Fonts?.sansBold, fontSize: 11, textAlign: 'center', paddingHorizontal: 4 },
  metricLabel: { fontFamily: Fonts?.sans, fontSize: 10, marginTop: 3, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 2 },

  sectionTitle: { fontFamily: Fonts?.sansBold, fontSize: 18, marginTop: 29, marginBottom: 12 },
  settings: { borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: Fonts?.sansSemiBold, fontSize: 14 },
  rowSub: { fontFamily: Fonts?.sans, fontSize: 11, marginTop: 3 },

  invite: {
    height: 55, borderRadius: 18, borderWidth: 1, marginTop: 14,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  inviteText: { flex: 1, fontFamily: Fonts?.sansSemiBold, fontSize: 14 },
  logoutButton: {
    height: 55, borderRadius: 18, borderWidth: 1, marginTop: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  logoutText: { color: '#EF4444', fontFamily: Fonts?.sansBold, fontSize: 14 },
});
