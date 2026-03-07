import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../utils/theme';

const STATUS_LABELS = {
  pending_seller: 'Awaiting Seller',
  pending_payment: 'Awaiting Payment',
  payment_received: 'Payment Verified',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending_seller: colors.warning,
  pending_payment: colors.warning,
  payment_received: colors.accent,
  shipped: colors.wtb,
  delivered: colors.wts,
  completed: colors.success,
  disputed: colors.error,
  cancelled: colors.textLight,
};

export default function EscrowListScreen({ navigation }) {
  const { user } = useAuth();
  const [escrows, setEscrows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => navigation.navigate('InitiateEscrow')}
      >
        <Text style={styles.newBtnText}>+ New Escrow</Text>
      </TouchableOpacity>

      <FlatList
        data={escrows}
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
          !refreshing && <Text style={styles.empty}>No escrow transactions yet</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadEscrows} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
      />
    </View>
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
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 16 },
});
