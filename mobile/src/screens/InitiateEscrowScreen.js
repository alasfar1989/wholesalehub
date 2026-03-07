import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function InitiateEscrowScreen({ route, navigation }) {
  const prefill = route.params || {};
  const [sellerId, setSellerId] = useState(prefill.sellerId || '');
  const [sellerName, setSellerName] = useState(prefill.sellerName || '');
  const [amount, setAmount] = useState(prefill.amount || '');
  const [description, setDescription] = useState(prefill.description || '');
  const [loading, setLoading] = useState(false);

  async function handleInitiate() {
    if (!sellerId || !amount || !description) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (parseFloat(amount) < 1) {
      Alert.alert('Error', 'Amount must be at least $1');
      return;
    }
    setLoading(true);
    try {
      const data = await api.initiateEscrow({
        seller_id: sellerId,
        amount: parseFloat(amount),
        product_description: description,
        listing_id: prefill.listingId || undefined,
      });
      Alert.alert('Escrow Created', 'Waiting for seller to confirm the deal.', [
        { text: 'OK', onPress: () => navigation.navigate('EscrowDetail', { id: data.escrow.id }) },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const fee = amount ? (parseFloat(amount) * 0.01).toFixed(2) : '0.00';
  const payout = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(2) : '0.00';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {sellerName ? (
        <Input label="Seller" value={sellerName} editable={false} />
      ) : (
        <Input
          label="Seller ID"
          placeholder="Enter seller's user ID"
          value={sellerId}
          onChangeText={setSellerId}
        />
      )}

      <Input
        label="Product Description"
        placeholder="e.g., 50x iPhone 15 Pro Max 256GB, sealed"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <Input
        label="Total Amount ($)"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      {amount ? (
        <>
          <Input label="Escrow Fee (1%)" value={`$${fee}`} editable={false} />
          <Input label="Seller Payout" value={`$${payout}`} editable={false} />
        </>
      ) : null}

      <Button title="Initiate Escrow" onPress={handleInitiate} loading={loading} style={{ marginTop: spacing.sm }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
});
