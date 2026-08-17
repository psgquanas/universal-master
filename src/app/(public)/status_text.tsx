import { Fonts } from '@/constants/theme';
import { createStatusPost } from '@/lib/posts';
import { useRouter } from 'expo-router';
import { Check, Smile, Type, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLORS = [
    '#075E54', // whatsapp deep green
    '#1F2C34',
    '#5B2333',
    '#2E4374',
    '#3E2723',
    '#4A148C',
    '#004D40',
    '#B71C1C',
    '#37474F',
    '#00695C',
];

const STICKERS = ['😀', '😂', '😍', '🔥', '🎉', '❤️', '👍', '😎', '🙌', '✨', '🥳', '😢'];

const FONT_STYLES: { label: string; family?: string }[] = [
    { label: 'Aa', family: Fonts?.sans },
    { label: 'Aa', family: Fonts?.sansBold },
    { label: 'Aa', family: Fonts?.sansMedium },
];

export default function TextStatusScreen() {
    const router = useRouter();
    const inputRef = useRef<TextInput>(null);

    const [text, setText] = useState('');
    const [bgColor, setBgColor] = useState(BG_COLORS[0]);
    const [fontIndex, setFontIndex] = useState(0);
    const [placedStickers, setPlacedStickers] = useState<
        { id: string; emoji: string; x: number; y: number }[]
    >([]);
    const [showStickerTray, setShowStickerTray] = useState(false);
    const [sharing, setSharing] = useState(false);
    const nextStickerId = useRef(0);

    const [fadeAnim] = useState(() => new Animated.Value(1));

    const handleAddSticker = (emoji: string) => {
        const id = `${emoji}-${nextStickerId.current++}`;
        setPlacedStickers((prev) => [
            ...prev,
            { id, emoji, x: 140 + Math.random() * 40 - 20, y: 260 + Math.random() * 40 - 20 },
        ]);
        setShowStickerTray(false);
    };

    const handleRemoveSticker = (id: string) => {
        setPlacedStickers((prev) => prev.filter((s) => s.id !== id));
    };

    const cycleFont = () => {
        setFontIndex((prev) => (prev + 1) % FONT_STYLES.length);
    };

    const canShare = text.trim().length > 0 || placedStickers.length > 0;

    const handleShare = async () => {
        if (!canShare || sharing) return;
        setSharing(true);
        try {
            const stickerText = placedStickers.map((sticker) => sticker.emoji).join(' ');
            await createStatusPost([text.trim(), stickerText].filter(Boolean).join('\n'));
            router.dismissTo('/(app)');
        } catch (error) {
            Alert.alert('Unable to share status', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setSharing(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <X size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={cycleFont} style={styles.headerBtn}>
                        <Type size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowStickerTray((prev) => !prev)}
                        style={styles.headerBtn}
                    >
                        <Smile size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Canvas */}
            <View style={styles.canvas}>
                <TextInput
                    ref={inputRef}
                    style={[
                        styles.textInput,
                        { fontFamily: FONT_STYLES[fontIndex].family },
                    ]}
                    value={text}
                    onChangeText={setText}
                    placeholder="Type a status"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    multiline
                    autoFocus
                    textAlign="center"
                />

                {placedStickers.map((sticker) => (
                    <TouchableOpacity
                        key={sticker.id}
                        style={[styles.placedSticker, { left: sticker.x, top: sticker.y }]}
                        onLongPress={() => handleRemoveSticker(sticker.id)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.placedStickerText}>{sticker.emoji}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Sticker Tray */}
            {showStickerTray && (
                <Animated.View style={[styles.stickerTray, { opacity: fadeAnim }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerTrayContent}>
                        {STICKERS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                style={styles.stickerOption}
                                onPress={() => handleAddSticker(emoji)}
                            >
                                <Text style={styles.stickerOptionText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Animated.View>
            )}

            {/* Color Picker */}
            <View style={styles.colorPickerRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPickerContent}>
                    {BG_COLORS.map((color) => (
                        <TouchableOpacity
                            key={color}
                            onPress={() => setBgColor(color)}
                            style={[
                                styles.colorSwatch,
                                { backgroundColor: color },
                                bgColor === color && styles.colorSwatchSelected,
                            ]}
                        >
                            {bgColor === color && <Check size={16} color="#fff" />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <Text style={styles.hintText}>Tap a sticker, hold to delete</Text>
                <TouchableOpacity
                    style={[styles.sendBtn, { opacity: canShare && !sharing ? 1 : 0.4 }]}
                    activeOpacity={0.85}
                    onPress={handleShare}
                    disabled={!canShare || sharing}
                >
                    <Text style={styles.sendBtnText}>{sharing ? 'Sharing...' : 'Share Status'}</Text>
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
        paddingHorizontal: 16,
        height: 52,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    canvas: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    textInput: {
        color: '#fff',
        fontSize: 28,
        lineHeight: 36,
        textAlign: 'center',
        minHeight: 60,
        maxHeight: 220,
    },
    placedSticker: {
        position: 'absolute',
    },
    placedStickerText: {
        fontSize: 40,
    },
    stickerTray: {
        paddingVertical: 10,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    stickerTrayContent: {
        paddingHorizontal: 16,
        gap: 14,
        alignItems: 'center',
    },
    stickerOption: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stickerOptionText: {
        fontSize: 28,
    },
    colorPickerRow: {
        paddingVertical: 10,
    },
    colorPickerContent: {
        paddingHorizontal: 16,
        gap: 10,
        alignItems: 'center',
    },
    colorSwatch: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorSwatchSelected: {
        borderColor: '#fff',
        transform: [{ scale: 1.15 }],
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 8,
        paddingBottom: 14,
    },
    hintText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontFamily: Fonts?.sans,
    },
    sendBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnText: {
        color: '#111',
        fontSize: 14,
        fontFamily: Fonts?.sansBold,
    },
});
