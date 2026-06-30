import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../utils/theme';

function sameDay(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

function dateLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function ChatScreen({ route }) {
  const { userId, name } = route.params;
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const flatListRef = useRef();
  const intervalRef = useRef();

  useEffect(() => {
    setBlocked(false);
    setSendError('');
    setLoaded(false);
    loadMessages();
    // Poll for new messages every 5s
    intervalRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(intervalRef.current);
  }, [userId]);

  async function loadMessages() {
    try {
      const data = await api.getMessages(userId);
      setMessages(data.messages || []);
      setBlocked(!!data.blocked);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setSendError('');
    try {
      await api.sendMessage({ to_user_id: userId, content: text.trim() });
      setText('');
      await loadMessages();
    } catch (err) {
      const msg = err?.message || 'Failed to send message';
      setSendError(msg);
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item, index }) {
    const isMine = item.from_user_id === user.id;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const showDate = index === 0 || !sameDay(item.created_at, prev?.created_at);
    const lastOfGroup = !next || next.from_user_id !== item.from_user_id || !sameDay(item.created_at, next.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{dateLabel(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}>
          {!isMine && (
            lastOfGroup ? (
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            ) : (
              <View style={styles.miniAvatarSpacer} />
            )
          )}
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              !lastOfGroup && (isMine ? styles.bubbleMineGrouped : styles.bubbleTheirsGrouped),
              { marginTop: prev && prev.from_user_id === item.from_user_id && !showDate ? 2 : spacing.sm },
            ]}
          >
            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.content}</Text>
            {lastOfGroup && (
              <View style={styles.timeRow}>
                <Text style={[styles.time, isMine && styles.timeMine]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.is_read ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={item.is_read ? '#9ad0ff' : 'rgba(255,255,255,0.6)'}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
        onContentSizeChange={() => messages.length && flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          loaded && !blocked ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyAvatar}>
                <Text style={styles.emptyAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.emptyTitle}>{name}</Text>
              <Text style={styles.emptyText}>Send a message to start the conversation</Text>
            </View>
          ) : null
        }
      />

      {blocked ? (
        <View style={[styles.blockedBanner, { paddingBottom: spacing.md + insets.bottom }]}>
          <Ionicons name="ban-outline" size={16} color={colors.error} />
          <Text style={styles.blockedText}>You cannot message this user</Text>
        </View>
      ) : (
        <>
          {sendError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          ) : null}
          <View style={[styles.inputRow, { paddingBottom: spacing.sm + insets.bottom }]}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={colors.textLight}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.sm },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  dateRow: { alignItems: 'center', marginVertical: spacing.md },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  miniAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.xs, marginBottom: 2,
  },
  miniAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  miniAvatarSpacer: { width: 26, marginRight: spacing.xs },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: colors.action,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleMineGrouped: { borderBottomRightRadius: 20 },
  bubbleTheirsGrouped: { borderBottomLeftRadius: 20 },
  messageText: { fontSize: 15, lineHeight: 20, color: colors.text },
  messageTextMine: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
  time: { fontSize: 11, color: colors.textLight },
  timeMine: { color: 'rgba(255,255,255,0.7)' },

  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.lg },
  emptyAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyAvatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  inputRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text,
  },
  sendBtn: {
    backgroundColor: colors.action,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { backgroundColor: colors.borderStrong },
  blockedBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  blockedText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    textAlign: 'center',
  },
});
