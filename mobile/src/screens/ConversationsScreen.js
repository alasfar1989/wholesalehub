import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { colors, spacing, radius, shadows } from '../utils/theme';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  async function loadConversations() {
    setRefreshing(true);
    try {
      const data = await api.getConversations();
      setConversations(data.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={item => item.other_user_id}
        contentContainerStyle={conversations.length === 0 ? styles.listEmpty : styles.listContent}
        renderItem={({ item }) => {
          const unread = item.unread_count > 0;
          const time = formatTime(item.last_time);
          return (
            <TouchableOpacity
              style={[styles.row, unread && styles.rowUnread]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Chat', { userId: item.other_user_id, name: item.business_name })}
            >
              <View style={styles.avatarWrap}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.business_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                    {item.business_name}
                  </Text>
                  {time ? <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text> : null}
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.lastMsg, unread && styles.lastMsgUnread]} numberOfLines={1}>
                    {item.last_message}
                  </Text>
                  {unread && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Conversations</Text>
              <Text style={styles.empty}>Message a seller to start chatting</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadConversations} tintColor={colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  listEmpty: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  rowUnread: {
    borderColor: colors.action,
    backgroundColor: colors.actionSoft,
  },
  avatarWrap: { marginRight: spacing.md },
  avatarImage: { width: 48, height: 48, borderRadius: radius.pill },
  avatar: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  nameUnread: { fontWeight: '800' },
  time: { fontSize: 12, color: colors.textLight },
  timeUnread: { color: colors.action, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 3 },
  lastMsg: { flex: 1, fontSize: 14, color: colors.textSecondary },
  lastMsgUnread: { color: colors.text, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.highlight,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs, letterSpacing: -0.2 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
});
