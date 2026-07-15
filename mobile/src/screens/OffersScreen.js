import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const STATUS_LABELS = {
  pending: 'Pending',
  countered: 'Countered',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
const STATUS_COLORS = {
  pending: colors.warning,
  countered: colors.accent,
  accepted: colors.success,
  declined: colors.error,
  withdrawn: colors.textLight,
};

export default function OffersScreen() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counterOffer, setCounterOffer] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getMyOffers();
      setOffers(data.offers);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Is it my turn to respond? pending -> seller acts, countered -> buyer acts.
  function myTurn(offer) {
    return (
      (offer.status === 'pending' && offer.my_role === 'seller') ||
      (offer.status === 'countered' && offer.my_role === 'buyer')
    );
  }
  function awaitingOther(offer) {
    return (
      (offer.status === 'pending' && offer.my_role === 'buyer') ||
      (offer.status === 'countered' && offer.my_role === 'seller')
    );
  }

  async function respond(offer, action, price) {
    try {
      await api.respondToOffer(offer.id, { action, ...(price != null ? { price } : {}) });
      load();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  async function withdraw(offer) {
    try {
      await api.withdrawOffer(offer.id);
      load();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  function submitCounter() {
    const p = parseFloat(counterPrice);
    if (Number.isNaN(p) || p < 0) {
      Alert.alert('Invalid price', 'Enter a valid counter price.');
      return;
    }
    const offer = counterOffer;
    setCounterOffer(null);
    setCounterPrice('');
    respond(offer, 'counter', p);
  }

  function renderItem({ item }) {
    const other = item.my_role === 'buyer' ? item.seller_name : item.buyer_name;
    const roleLabel = item.my_role === 'buyer' ? 'You offered' : `${item.buyer_name} offered`;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.listing_title}</Text>
          <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[item.status] || colors.textLight }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
        </View>

        <Text style={styles.offerLine}>
          {roleLabel} <Text style={styles.offerPrice}>${Number(item.price).toLocaleString()}</Text>
          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
        </Text>
        <Text style={styles.counterparty}>
          {item.my_role === 'buyer' ? 'Seller' : 'Buyer'}: {other}
        </Text>
        {item.message ? <Text style={styles.message}>"{item.message}"</Text> : null}

        {myTurn(item) && (
          <View style={styles.actions}>
            <Button title="Accept" onPress={() => respond(item, 'accept')} style={styles.actionBtn} textStyle={styles.actionText} />
            <Button title="Counter" variant="outline" onPress={() => { setCounterOffer(item); setCounterPrice(String(item.price)); }} style={styles.actionBtn} textStyle={styles.actionText} />
            <Button title="Decline" variant="danger" onPress={() => respond(item, 'decline')} style={styles.actionBtn} textStyle={styles.actionText} />
          </View>
        )}
        {awaitingOther(item) && (
          <View style={styles.awaitingRow}>
            <Text style={styles.awaiting}>Awaiting response…</Text>
            <TouchableOpacity onPress={() => withdraw(item)}>
              <Text style={styles.withdraw}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={loading}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No offers yet</Text>
              <Text style={styles.emptyText}>Offers you send or receive will appear here.</Text>
            </View>
          ) : null
        }
      />

      <Modal visible={!!counterOffer} transparent animationType="fade" onRequestClose={() => setCounterOffer(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Counter Offer</Text>
            <Text style={styles.modalLabel}>New price (per unit)</Text>
            <Input placeholder="0.00" value={counterPrice} onChangeText={setCounterPrice} keyboardType="numeric" />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => { setCounterOffer(null); setCounterPrice(''); }} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button title="Send" onPress={submitCounter} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listingTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  offerLine: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
  offerPrice: { fontSize: 16, fontWeight: '800', color: colors.primary },
  counterparty: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  message: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  actionBtn: { flex: 1, minHeight: 40, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 13 },
  awaitingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  awaiting: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },
  withdraw: { fontSize: 13, color: colors.error, fontWeight: '600', textDecorationLine: 'underline' },
  empty: { alignItems: 'center', marginTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  modalLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  modalActions: { flexDirection: 'row', marginTop: spacing.md },
});
