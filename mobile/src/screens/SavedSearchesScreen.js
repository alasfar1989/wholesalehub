import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { colors, spacing } from '../utils/theme';

function describe(s) {
  const parts = [];
  if (s.keyword) parts.push(`"${s.keyword}"`);
  if (s.type) parts.push(s.type);
  if (s.category) parts.push(s.category);
  if (s.condition) parts.push(s.condition);
  if (s.city) parts.push(s.city);
  if (s.min_price != null) parts.push(`min $${Number(s.min_price).toLocaleString()}`);
  if (s.max_price != null) parts.push(`max $${Number(s.max_price).toLocaleString()}`);
  return parts.length ? parts.join(' · ') : 'All listings';
}

export default function SavedSearchesScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getSavedSearches();
      setItems(data.saved_searches);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(item) {
    Alert.alert('Delete saved search', 'Stop getting alerts for this search?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSavedSearch(item.id);
            setItems((prev) => prev.filter((x) => x.id !== item.id));
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={loading}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.hint}>You'll get a notification when a new listing matches one of these.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text style={styles.cardText}>{describe(item)}</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No saved searches</Text>
              <Text style={styles.emptyText}>Run a search, then tap "Save Search" to get alerts for new matches.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm, gap: spacing.sm },
  cardText: { fontSize: 14, color: colors.text, fontWeight: '500', flex: 1 },
  empty: { alignItems: 'center', marginTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
});
