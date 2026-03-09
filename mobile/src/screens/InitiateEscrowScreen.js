import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function InitiateEscrowScreen({ route, navigation }) {
  const prefill = route.params || {};
  const { user } = useAuth();

  // Steps: 'type' -> 'listing' -> 'form'
  const [step, setStep] = useState(prefill.sellerId ? 'form' : 'type');
  const [selectedType, setSelectedType] = useState('');
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const [sellerId, setSellerId] = useState(prefill.sellerId || '');
  const [sellerName, setSellerName] = useState(prefill.sellerName || '');
  const [listingId, setListingId] = useState(prefill.listingId || '');
  const [amount, setAmount] = useState(prefill.amount || '');
  const [description, setDescription] = useState(prefill.description || '');
  const [paymentMethod, setPaymentMethod] = useState('wire');
  const [loading, setLoading] = useState(false);

  function pickType(type) {
    setSelectedType(type);
    setStep('listing');
    loadListings(type);
  }

  async function loadListings(type) {
    setLoadingListings(true);
    try {
      const data = await api.searchListings({ type });
      setListings(data.listings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingListings(false);
    }
  }

  function selectListing(listing) {
    if (listing.user_id === user.id) {
      Alert.alert('Error', 'You cannot escrow your own listing');
      return;
    }
    setSelectedListing(listing);
    setSellerId(listing.user_id);
    setSellerName(listing.business_name);
    setListingId(listing.id);
    setDescription(`${listing.title} - Qty: ${listing.quantity}`);
    setAmount(listing.price ? String(listing.price) : '');
    setStep('form');
  }

  function goBack() {
    if (step === 'listing') {
      setStep('type');
      setListings([]);
    } else if (step === 'form' && !prefill.sellerId) {
      setSelectedListing(null);
      setSellerId('');
      setSellerName('');
      setListingId('');
      setDescription('');
      setAmount('');
      setStep('listing');
    }
  }

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
        listing_id: listingId || undefined,
        payment_method: paymentMethod,
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

  // Step 1: Pick WTS or WTB
  if (step === 'type') {
    return (
      <View style={styles.container}>
        <View style={styles.typeHeader}>
          <Text style={styles.stepTitle}>Start an Escrow</Text>
          <Text style={styles.stepHint}>What type of listing do you want to escrow?</Text>
        </View>
        <View style={styles.typeCards}>
          <TouchableOpacity style={[styles.typeCard, { borderColor: colors.wts }]} onPress={() => pickType('WTS')}>
            <View style={[styles.typeIcon, { backgroundColor: colors.wts }]}>
              <Text style={styles.typeIconText}>WTS</Text>
            </View>
            <Text style={styles.typeCardTitle}>Want to Sell</Text>
            <Text style={styles.typeCardHint}>Buy from a seller's listing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeCard, { borderColor: colors.wtb }]} onPress={() => pickType('WTB')}>
            <View style={[styles.typeIcon, { backgroundColor: colors.wtb }]}>
              <Text style={styles.typeIconText}>WTB</Text>
            </View>
            <Text style={styles.typeCardTitle}>Want to Buy</Text>
            <Text style={styles.typeCardHint}>Sell to a buyer's request</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 2: Pick a listing
  if (step === 'listing') {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={goBack}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.stepTitle}>
            {selectedType === 'WTS' ? 'Select a WTS Listing' : 'Select a WTB Listing'}
          </Text>
          <Text style={styles.stepHint}>
            {selectedType === 'WTS'
              ? 'Pick the listing you want to buy from'
              : 'Pick the buyer request you want to fulfill'}
          </Text>
        </View>
        {loadingListings ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={listings}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const isOwn = item.user_id === user.id;
              return (
                <TouchableOpacity
                  style={[styles.listingItem, isOwn && styles.listingItemOwn]}
                  onPress={() => selectListing(item)}
                  disabled={isOwn}
                >
                  <View style={styles.listingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.listingSub}>
                        {item.business_name} - {item.city}
                      </Text>
                      <Text style={styles.listingMeta}>
                        Qty: {item.quantity} - {item.condition}
                      </Text>
                      {isOwn && <Text style={styles.ownLabel}>Your listing</Text>}
                    </View>
                    <Text style={styles.listingPrice}>
                      {item.price ? `$${Number(item.price).toLocaleString()}` : 'DM'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No {selectedType} listings available right now
              </Text>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  // Step 3: Escrow form
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Selected listing summary */}
      {selectedListing && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={[styles.typeBadge, { backgroundColor: selectedListing.type === 'WTS' ? colors.wts : colors.wtb }]}>
              <Text style={styles.typeBadgeText}>{selectedListing.type}</Text>
            </View>
            <TouchableOpacity onPress={goBack}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedTitle}>{selectedListing.title}</Text>
          <Text style={styles.selectedSub}>{sellerName} - Qty: {selectedListing.quantity}</Text>
        </View>
      )}

      {!selectedListing && sellerName && (
        <Input label="Seller" value={sellerName} editable={false} />
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

      {/* Payment Method */}
      <Text style={styles.fieldLabel}>Payment Method</Text>
      <View style={styles.paymentRow}>
        <TouchableOpacity
          style={[styles.paymentOption, paymentMethod === 'wire' && styles.paymentActive]}
          onPress={() => setPaymentMethod('wire')}
        >
          <Text style={[styles.paymentText, paymentMethod === 'wire' && styles.paymentTextActive]}>Wire Transfer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.paymentOption, paymentMethod === 'usdt' && styles.paymentActive]}
          onPress={() => setPaymentMethod('usdt')}
        >
          <Text style={[styles.paymentText, paymentMethod === 'usdt' && styles.paymentTextActive]}>USDT</Text>
        </TouchableOpacity>
      </View>

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
  typeHeader: { padding: spacing.lg, paddingBottom: spacing.md },
  stepTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  stepHint: { fontSize: 14, color: colors.textSecondary },
  typeCards: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.md },
  typeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeIconText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  typeCardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  typeCardHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  listHeader: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  listContent: { paddingBottom: spacing.xl },
  listingItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listingItemOwn: { opacity: 0.4 },
  listingRow: { flexDirection: 'row', alignItems: 'center' },
  listingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listingPrice: { fontSize: 16, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm },
  listingSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  listingMeta: { fontSize: 12, color: colors.textLight, marginTop: 2, textTransform: 'capitalize' },
  ownLabel: { fontSize: 11, color: colors.textLight, fontStyle: 'italic', marginTop: 2 },
  selectedCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  selectedTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4 },
  selectedSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  changeLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  paymentRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  paymentOption: {
    flex: 1,
    padding: spacing.sm + 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  paymentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentText: { fontSize: 15, fontWeight: '600', color: colors.text },
  paymentTextActive: { color: '#fff' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 15 },
});
