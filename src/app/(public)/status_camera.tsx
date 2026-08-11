import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, Image as ImageIcon, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedMedia] = useState<string | null>(null);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Add Photo / Video</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Preview Area */}
        <View style={[styles.previewArea, { backgroundColor: theme.backgroundElement }]}>
          {selectedMedia ? (
            <Image source={{ uri: selectedMedia }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Camera size={48} color={theme.textSecondary} strokeWidth={1.5} />
              <Text style={[styles.previewPlaceholderText, { color: theme.textSecondary }]}>
                Tap a button below to add media
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]}
            activeOpacity={0.7}
          >
            <Camera size={24} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]}
            activeOpacity={0.7}
          >
            <ImageIcon size={24} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Choose Image</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]}
            activeOpacity={0.7}
          >
            <Video size={24} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Record Video</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Post Button - now inside SafeAreaView so the home-indicator inset is respected */}
      <View style={[styles.bottomSection, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: selectedMedia ? theme.primary : theme.backgroundElement }]}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text style={[styles.postBtnText, { color: selectedMedia ? '#fff' : theme.textSecondary }]}>
            Share Status
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts?.sansBold,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 24,
  },
  previewArea: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    alignItems: 'center',
    gap: 12,
  },
  previewPlaceholderText: {
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: Fonts?.sansMedium,
  },
  bottomSection: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    fontSize: 16,
    fontFamily: Fonts?.sansBold,
  },
});