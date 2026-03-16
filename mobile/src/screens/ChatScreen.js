import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../utils/theme';

export default function ChatScreen({ route }) {
  const { userId, name } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef();
  const intervalRef = useRef();

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 5s
    intervalRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(intervalRef.current);
  }, [userId]);

  async function loadMessages() {
    try {
      const data = await api.getMessages(userId);
      setMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.sendMessage({ to_user_id: userId, content: text.trim() });
      setText('');
      await loadMessages();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }) {
    const isMine = item.from_user_id === user.id;
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.content}</Text>
        <View style={styles.timeRow}>
          <Text style={[styles.time, isMine && styles.timeMine]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMine && (
            <Text style={[styles.readReceipt, item.is_read && styles.readReceiptRead]}>
              {item.is_read ? ' ✓✓' : ' ✓'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.headerName}>{name}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textLight}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  list: { padding: spacing.md, paddingBottom: spacing.sm },
  bubble: {
    maxWidth: '75%',
    padding: spacing.sm + 2,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, color: colors.text },
  messageTextMine: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  time: { fontSize: 11, color: colors.textLight },
  timeMine: { color: 'rgba(255,255,255,0.7)' },
  readReceipt: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  readReceiptRead: { color: '#90caf9' },
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
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
