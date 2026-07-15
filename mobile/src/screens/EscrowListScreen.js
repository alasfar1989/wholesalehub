import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, shadows } from '../utils/theme';

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

// Soft tinted pills (bg + text) for escrow state — mirrors the WTS/WTB badge style.
const STATUS_STYLES = {
  pending_seller: { bg: colors.warningSoft, text: colors.warning },
  pending_payment: { bg: colors.warningSoft, text: colors.warning },
  payment_received: { bg: colors.actionSoft, text: colors.actionDark },
  deposit_pending: { bg: colors.warningSoft, text: colors.warning },
  shipped: { bg: colors.wtbSoft, text: colors.wtbText },
  shipped_to_warehouse: { bg: colors.wtbSoft, text: colors.wtbText },
  at_warehouse: { bg: colors.warningSoft, text: colors.warning },
  delivered: { bg: colors.wtsSoft, text: colors.wtsText },
  completed: { bg: colors.successSoft, text: colors.success },
  disputed: { bg: colors.errorSoft, text: colors.error },
  inspection_failed: { bg: colors.errorSoft, text: colors.error },
  cancelled: { bg: colors.surfaceAlt, text: colors.textSecondary },
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
        activeOpacity={0.85}
        onPress={() => navigation.navigate('InitiateEscrow')}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.newBtnText}>New Escrow</Text>
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
          const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.cancelled;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusStyle.text }]} />
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>{STATUS_LABELS[item.status]}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Ionicons
                    name={isBuyer ? 'cart-outline' : 'pricetag-outline'}
                    size={12}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.role}>{isBuyer ? 'Buyer' : 'Seller'}</Text>
                </View>
              </View>

              <Text style={styles.product} numberOfLines={1}>{item.product_description}</Text>
              <Text style={styles.amount}>${Number(item.amount).toLocaleString()}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.party} numberOfLines={1}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.action,
    margin: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 50,
    ...shadows.sm,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  list: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  role: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  product: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4, letterSpacing: -0.2 },
  amount: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: spacing.sm, letterSpacing: -0.3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  party: { fontSize: 13, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  date: { fontSize: 12, color: colors.textLight },
  filterRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  filterBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  emptyContainer: { alignItems: 'center', marginTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs, letterSpacing: -0.2 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
});
