import { BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteScheduledMessage,
  getScheduledMessages,
  getScheduleRecipients,
  saveScheduledMessage,
  ScheduleRecipient,
  ScheduledMessageRecord,
  sendScheduledMessageNow,
  setScheduledMessagePaused,
} from '@/lib/scheduled-messages';
import { useFocusEffect } from 'expo-router';
import { AlertCircle, CalendarClock, CheckCheck, ChevronLeft, ChevronRight, Clock3, Edit3, Minus, Pause, Play, Plus, Search, Send, Trash2, UserRound, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Filter = 'all' | 'pending' | 'recurring' | 'sent' | 'failed';

const formatDate = (value: string | Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

function futureDefault() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  date.setHours(date.getHours() + 1);
  return date;
}

export default function SchedulingScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [messages, setMessages] = useState<ScheduledMessageRecord[]>([]);
  const [recipients, setRecipients] = useState<ScheduleRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [composerVisible, setComposerVisible] = useState(false);
  const [recipientPickerVisible, setRecipientPickerVisible] = useState(false);
  const [selected, setSelected] = useState<ScheduleRecipient | null>(null);
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [scheduledFor, setScheduledFor] = useState(futureDefault);
  const [totalDays, setTotalDays] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [active, setActive] = useState<ScheduledMessageRecord | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [scheduleRows, recipientRows] = await Promise.all([getScheduledMessages(), getScheduleRecipients()]);
      setMessages(scheduleRows);
      setRecipients(recipientRows);
    } catch (error) {
      console.warn('[scheduling] load failed', error);
      Alert.alert('Could not load schedules', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void loadData();
  }, [loadData]));

  const visible = useMemo(
    () => filter === 'all' ? messages : messages.filter((message) => message.status === filter),
    [filter, messages],
  );
  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? recipients.filter((recipient) => recipient.name.toLowerCase().includes(query)) : recipients;
  }, [recipients, search]);

  const resetComposer = () => {
    setEditingId(null);
    setSelected(null);
    setContent('');
    setScheduledFor(futureDefault());
    setTotalDays(1);
  };

  const openComposer = (existing?: ScheduledMessageRecord) => {
    if (existing) {
      setEditingId(existing.id);
      setSelected({ id: existing.recipient_id, name: existing.recipient_name });
      setContent(existing.content);
      setScheduledFor(new Date(existing.scheduled_for));
      setTotalDays(existing.total_days);
    } else resetComposer();
    setActive(null);
    setComposerVisible(true);
  };

  const adjustDate = (days: number) => {
    setScheduledFor((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const adjustTime = (minutes: number) => {
    setScheduledFor((current) => new Date(current.getTime() + minutes * 60_000));
  };

  const handleSave = async () => {
    if (!selected) return Alert.alert('Choose a recipient', 'Select the person who should receive this message.');
    if (!content.trim()) return Alert.alert('Write a message', 'The scheduled message cannot be empty.');
    if (scheduledFor <= new Date()) return Alert.alert('Choose a future time', 'The first delivery must be in the future.');
    setSaving(true);
    try {
      await saveScheduledMessage({
        id: editingId ?? undefined,
        recipientId: selected.id,
        content,
        scheduledFor,
        totalDays,
      });
      setComposerVisible(false);
      resetComposer();
      await loadData();
    } catch (error) {
      Alert.alert('Could not save schedule', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const perform = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
      setActive(null);
      await loadData();
    } catch (error) {
      Alert.alert(failure, error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.title}>Scheduled messages</Text><Text style={styles.subtitle}>Write it now. We will deliver it while you are busy.</Text></View>
          <View style={styles.headerIcon}><CalendarClock size={24} color={theme.primary} /></View>
        </View>

        <TouchableOpacity style={styles.newButton} onPress={() => openComposer()}>
          <Plus size={20} color="#fff" /><Text style={styles.newButtonText}>Create schedule</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'pending', 'recurring', 'sent', 'failed'] as Filter[]).map((value) => (
            <TouchableOpacity key={value} style={[styles.filter, filter === value && styles.filterActive]} onPress={() => setFilter(value)}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 50 }} /> : visible.length === 0 ? (
          <View style={styles.empty}><Clock3 size={28} color={theme.primary} /><Text style={styles.emptyTitle}>Nothing scheduled</Text><Text style={styles.emptyText}>Your saved and delivered schedules will appear here.</Text></View>
        ) : visible.map((item) => {
          const sent = item.status === 'sent';
          const failed = item.status === 'failed';
          const StatusIcon = sent ? CheckCheck : failed ? AlertCircle : Clock3;
          const statusColor = sent ? '#22C55E' : failed ? '#EF4444' : theme.primary;
          return (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => setActive(item)} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.recipient_name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.recipient}>{item.recipient_name}</Text><Text style={styles.date}>{formatDate(item.scheduled_for)}</Text></View>
                <View style={[styles.status, { backgroundColor: `${statusColor}18` }]}><StatusIcon size={12} color={statusColor} /><Text style={[styles.statusText, { color: statusColor }]}>{item.paused ? 'Paused' : item.status}</Text></View>
              </View>
              <Text style={styles.message} numberOfLines={3}>{item.content}</Text>
              <Text style={styles.progress}>{item.days_sent} of {item.total_days} deliveries sent</Text>
              {item.last_error ? <Text style={styles.errorText}>{item.last_error}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={composerVisible} animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setComposerVisible(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Edit schedule' : 'New schedule'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={styles.done}>{saving ? 'Saving...' : 'Done'}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>RECIPIENT</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setRecipientPickerVisible(true)}>
              <UserRound size={19} color={theme.textSecondary} /><Text style={[styles.selectorText, !selected && { color: theme.textSecondary }]}>{selected?.name || 'Choose a friend'}</Text><ChevronRight size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.label}>MESSAGE</Text>
            <TextInput style={styles.messageInput} value={content} onChangeText={setContent} placeholder="Write the message to send..." placeholderTextColor={theme.textSecondary} multiline maxLength={1000} textAlignVertical="top" />
            <Text style={styles.count}>{content.length}/1000</Text>

            <Text style={styles.label}>FIRST DELIVERY DATE</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustDate(-1)}><ChevronLeft size={20} color={theme.primary} /></TouchableOpacity>
              <View style={styles.stepValue}><Text style={styles.stepMain}>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(scheduledFor)}</Text><Text style={styles.stepSub}>{scheduledFor.getFullYear()}</Text></View>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustDate(1)}><ChevronRight size={20} color={theme.primary} /></TouchableOpacity>
            </View>

            <Text style={styles.label}>DELIVERY TIME</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustTime(-15)}><Minus size={20} color={theme.primary} /></TouchableOpacity>
              <View style={styles.stepValue}><Text style={styles.stepMain}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(scheduledFor)}</Text><Text style={styles.stepSub}>15-minute intervals</Text></View>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustTime(15)}><Plus size={20} color={theme.primary} /></TouchableOpacity>
            </View>

            <Text style={styles.label}>NUMBER OF DAYS</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepButton} onPress={() => setTotalDays((value) => Math.max(1, value - 1))}><Minus size={20} color={theme.primary} /></TouchableOpacity>
              <View style={styles.stepValue}><Text style={styles.stepMain}>{totalDays}</Text><Text style={styles.stepSub}>{totalDays === 1 ? 'send once' : 'send once daily'}</Text></View>
              <TouchableOpacity style={styles.stepButton} onPress={() => setTotalDays((value) => Math.min(365, value + 1))}><Plus size={20} color={theme.primary} /></TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={recipientPickerVisible} transparent animationType="slide" onRequestClose={() => setRecipientPickerVisible(false)}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Choose a friend</Text><TouchableOpacity onPress={() => setRecipientPickerVisible(false)}><X size={20} color={theme.textSecondary} /></TouchableOpacity></View>
          <View style={styles.search}><Search size={17} color={theme.textSecondary} /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search friends" placeholderTextColor={theme.textSecondary} /></View>
          <ScrollView style={{ maxHeight: 390 }}>
            {filteredRecipients.length === 0 ? <Text style={styles.noFriends}>No friends available. Add a friend before scheduling a message.</Text> : filteredRecipients.map((recipient) => (
              <TouchableOpacity key={recipient.id} style={styles.personRow} onPress={() => { setSelected(recipient); setRecipientPickerVisible(false); }}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{recipient.name.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.personName}>{recipient.name}</Text>{selected?.id === recipient.id ? <CheckCheck size={18} color={theme.primary} /> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={Boolean(active)} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <Pressable style={styles.overlay} onPress={() => setActive(null)}><Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          {active ? <>
            <Text style={styles.sheetTitle}>{active.recipient_name}</Text><Text style={styles.preview} numberOfLines={3}>{active.content}</Text>
            {active.status !== 'sent' ? <>
              {active.days_sent === 0 ? <TouchableOpacity style={styles.action} onPress={() => openComposer(active)}><Edit3 size={19} color={theme.text} /><Text style={styles.actionText}>Edit schedule</Text></TouchableOpacity> : null}
              <TouchableOpacity style={styles.action} onPress={() => void perform(() => setScheduledMessagePaused(active.id, !active.paused), 'Could not update schedule')}>{active.paused ? <Play size={19} color={theme.text} /> : <Pause size={19} color={theme.text} />}<Text style={styles.actionText}>{active.paused ? 'Resume' : 'Pause'}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => void perform(() => sendScheduledMessageNow(active.id), 'Could not send message')}><Send size={19} color={theme.primary} /><Text style={[styles.actionText, { color: theme.primary }]}>Send now</Text></TouchableOpacity>
            </> : null}
            <TouchableOpacity style={styles.action} onPress={() => void perform(() => deleteScheduledMessage(active.id), 'Could not delete schedule')}><Trash2 size={19} color="#EF4444" /><Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text></TouchableOpacity>
          </> : null}
        </Pressable></Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background }, modalSafe: { flex: 1, backgroundColor: theme.background },
  content: { padding: Spacing.four, paddingBottom: BottomTabInset + Spacing.five },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  title: { color: theme.text, fontFamily: Fonts?.sansExtraBold, fontSize: 29 }, subtitle: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13.5, marginTop: 4 },
  headerIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  newButton: { height: 54, borderRadius: 18, backgroundColor: theme.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, newButtonText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 15 },
  filters: { gap: 8, paddingVertical: 18 }, filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 15, backgroundColor: theme.backgroundElement }, filterActive: { backgroundColor: theme.primary }, filterText: { color: theme.textSecondary, fontFamily: Fonts?.sansSemiBold, fontSize: 12 }, filterTextActive: { color: '#fff' },
  empty: { marginTop: 22, padding: 36, alignItems: 'center', borderRadius: 22, backgroundColor: theme.backgroundElement }, emptyTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16, marginTop: 12 }, emptyText: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, textAlign: 'center', marginTop: 5 },
  card: { padding: 16, borderRadius: 20, backgroundColor: theme.backgroundElement, marginBottom: 12 }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 40, height: 40, borderRadius: 15, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontFamily: Fonts?.sansBold, fontSize: 15 }, recipient: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 14 }, date: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11.5, marginTop: 2 }, status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 }, statusText: { fontFamily: Fonts?.sansSemiBold, fontSize: 10.5, textTransform: 'capitalize' }, message: { color: theme.text, fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, marginTop: 12 }, progress: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 11, marginTop: 10 }, errorText: { color: '#EF4444', fontFamily: Fonts?.sans, fontSize: 11, marginTop: 5 },
  modalHeader: { height: 58, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 16 }, cancel: { color: theme.textSecondary, fontFamily: Fonts?.sansMedium, fontSize: 14 }, done: { color: theme.primary, fontFamily: Fonts?.sansBold, fontSize: 14 },
  form: { padding: Spacing.four, paddingBottom: 60 }, label: { color: theme.textSecondary, fontFamily: Fonts?.sansBold, fontSize: 11, letterSpacing: 1, marginTop: 20, marginBottom: 9 }, selector: { height: 56, borderRadius: 16, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15 }, selectorText: { flex: 1, color: theme.text, fontFamily: Fonts?.sansMedium, fontSize: 15 }, messageInput: { minHeight: 130, borderRadius: 18, backgroundColor: theme.backgroundElement, padding: 16, color: theme.text, fontFamily: Fonts?.sans, fontSize: 15 }, count: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11, textAlign: 'right', marginTop: 5 },
  stepper: { height: 72, borderRadius: 18, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center' }, stepButton: { width: 58, height: '100%', alignItems: 'center', justifyContent: 'center' }, stepValue: { flex: 1, alignItems: 'center' }, stepMain: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 17 }, stepSub: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 11, marginTop: 3 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }, sheet: { backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: BottomTabInset + 20 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, sheetTitle: { color: theme.text, fontFamily: Fonts?.sansBold, fontSize: 17 }, search: { height: 46, borderRadius: 15, backgroundColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginBottom: 10 }, searchInput: { flex: 1, color: theme.text, fontFamily: Fonts?.sans, fontSize: 14 }, noFriends: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, textAlign: 'center', padding: 28 }, personRow: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, personName: { flex: 1, color: theme.text, fontFamily: Fonts?.sansSemiBold, fontSize: 14.5 }, preview: { color: theme.textSecondary, fontFamily: Fonts?.sans, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 10 }, action: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundElement, flexDirection: 'row', alignItems: 'center', gap: 13 }, actionText: { color: theme.text, fontFamily: Fonts?.sansSemiBold, fontSize: 15 },
});
