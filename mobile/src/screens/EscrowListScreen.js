import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../utils/theme';

const STATUS_LABELS = {
  pending_seller: 'Awaiting Seller',
  pending_payment: 'Awaiting Payment',
  payment_received: 'Payment Verified',
  deposit_pending: 'Deposit Pending',
  shipped: 'Shipped',
  shipped_to_warehouse: 'Shipped to Warehouse',
  at_warehouse: 'At Warehouse',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Disputed',
  inspection_failed: 'Inspection Failed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending_seller: colors.warning,
  pending_payment: colors.warning,
  payment_received: colors.accent,
  deposit_pending: colors.warning,
  shipped: colors.wtb,
  shipped_to_warehouse: colors.wtb,
  at_warehouse: colors.warning,
  delivered: colors.wts,
  completed: colors.success,
  disputed: colors.error,
  inspection_failed: colors.error,
  cancelled: colors.textLight,
};

export default function EscrowListScreen({ navigation }) {
  const { user } = useAuth();
  const [escrows, setEscrows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  useFocusEffect(
    useCallback(() => {
      loadEscrows();
    }, [])
  );

  async function loadEscrows() {
    setRefreshing(true);
    try {
      const data = await api.getMyEscrows();
      setEscrows(data.escrows);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => navigation.navigate('InitiateEscrow')}
      >
        <Text style={styles.newBtnText}>+ New Escrow</Text>
      </TouchableOpacity>

      <View style={styles.filterRow}>
        {['all', 'active', 'completed', 'cancelled'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={escrows.filter(e => {
          if (filter === 'all') return true;
          if (filter === 'active') return !['completed', 'cancelled', 'inspection_failed'].includes(e.status);
          if (filter === 'completed') return e.status === 'completed';
          if (filter === 'cancelled') return ['cancelled', 'inspection_failed'].includes(e.status);
          return true;
        })}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isBuyer = item.buyer_id === user.id;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
                </View>
                <Text style={styles.role}>{isBuyer ? 'Buyer' : 'Seller'}</Text>
              </View>

              <Text style={styles.product} numberOfLines={1}>{item.product_description}</Text>
              <Text style={styles.amount}>${Number(item.amount).toLocaleString()}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.party}>
                  {isBuyer ? `Seller: ${item.seller_name}` : `Buyer: ${item.buyer_name}`}
                </Text>
                <Text style={styles.date}>{new Date(item.updated_at).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No Escrow Transactions</Text>
              <Text style={styles.empty}>Start a secure transaction with the button above</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadEscrows} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  newBtn: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  list: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  role: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  product: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  amount: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  party: { fontSize: 13, color: colors.textSecondary },
  date: { fontSize: 12, color: colors.textLight },
  filterRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  filterBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  emptyContainer: { alignItems: 'center', marginTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
});
