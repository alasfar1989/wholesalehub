import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function MakeOfferScreen({ route, navigation }) {
  const { listing } = route.params;
  const [price, setPrice] = useState(listing.price ? String(listing.price) : '');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Enter a valid offer price.');
      return;
    }
    setLoading(true);
    try {
      await api.createOffer({
        listing_id: listing.id,
        price: priceNum,
        quantity: parseInt(quantity, 10) || 1,
        message: message.trim(),
      });
      Alert.alert('Offer sent', 'The seller has been notified of your offer.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.listingCard}>
          <Text style={styles.listingTitle}>{listing.title}</Text>
          <Text style={styles.listingPrice}>
            Asking: {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
          </Text>
          <Text style={styles.listingSeller}>Seller: {listing.business_name}</Text>
        </View>

        <Text style={styles.label}>Your offer price (per unit)</Text>
        <Input placeholder="0.00" value={price} onChangeText={setPrice} keyboardType="numeric" />

        <Text style={styles.label}>Quantity</Text>
        <Input placeholder="1" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

        <Text style={styles.label}>Message (optional)</Text>
        <Input
          placeholder="Add a note for the seller..."
          value={message}
          onChangeText={setMessage}
          multiline
          style={{ height: 90, textAlignVertical: 'top' }}
        />

        <Button title="Send Offer" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  listingTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  listingPrice: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  listingSeller: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
});
