import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { colors, spacing } from '../utils/theme';

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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, item.unread_count > 0 && styles.rowUnread]}
            onPress={() => navigation.navigate('Chat', { userId: item.other_user_id, name: item.business_name })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.business_name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, item.unread_count > 0 && styles.nameUnread]}>{item.business_name}</Text>
                {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.lastMsg, item.unread_count > 0 && styles.lastMsgUnread]} numberOfLines={1}>{item.last_message}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !refreshing && <Text style={styles.empty}>No conversations yet</Text>
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
  row: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  lastMsg: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  unreadBadge: {
    backgroundColor: colors.highlight,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowUnread: { backgroundColor: '#f0f4ff' },
  nameUnread: { fontWeight: '800' },
  lastMsgUnread: { color: colors.text, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 16 },
});
