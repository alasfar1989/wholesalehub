import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const WIRE_FEE = 25;
const MIN_FEE = 50;

function getEscrowFeePercent(amount) {
  if (amount >= 100000) return 0.01;
  if (amount >= 25000) return 0.015;
  if (amount >= 5000) return 0.025;
  return 0.04;
}

function getSellerDeposit(amount) {
  if (amount >= 100000) return 1000;
  if (amount >= 25000) return 500;
  if (amount >= 5000) return 250;
  return 100;
}

function getFeeLabel(amount) {
  if (amount >= 100000) return '1%';
  if (amount >= 25000) return '1.5%';
  if (amount >= 5000) return '2.5%';
  return '4%';
}

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
  const [paymentMethod, setPaymentMethod] = useState('wire');
  const [feePayer, setFeePayer] = useState('buyer'); // 'buyer', 'seller', 'split'
  const [loading, setLoading] = useState(false);

  // Multi-line items
  const [lineItems, setLineItems] = useState([
    {
      description: prefill.description || '',
      pricePerUnit: prefill.amount || '',
      quantity: '1',
    },
  ]);

  function updateLineItem(index, field, value) {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', pricePerUnit: '', quantity: '1' }]);
  }

  function removeLineItem(index) {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

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
    setLineItems([{
      description: listing.title,
      pricePerUnit: listing.price ? String(listing.price) : '',
      quantity: listing.quantity ? String(listing.quantity) : '1',
    }]);
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
      setLineItems([{ description: '', pricePerUnit: '', quantity: '1' }]);
      setStep('listing');
    }
  }

  // Calculations
  const itemSubtotals = lineItems.map(item => {
    const price = parseFloat(item.pricePerUnit) || 0;
    const qty = parseInt(item.quantity) || 0;
    return price * qty;
  });
  const invoiceTotal = itemSubtotals.reduce((sum, s) => sum + s, 0);
  const feePercent = getEscrowFeePercent(invoiceTotal);
  const escrowFee = invoiceTotal > 0 ? Math.max(MIN_FEE, invoiceTotal * feePercent) : 0;
  const sellerDeposit = invoiceTotal > 0 ? getSellerDeposit(invoiceTotal) : 0;
  const wireFee = paymentMethod === 'wire' ? WIRE_FEE : 0;
  const buyerFee = feePayer === 'buyer' ? escrowFee : 0;
  const sellerFee = feePayer === 'seller' ? escrowFee : 0;
  const buyerTotal = invoiceTotal + buyerFee + wireFee;
  const sellerPayout = invoiceTotal - sellerFee;

  async function handleInitiate() {
    // Validate all line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.description.trim()) {
        Alert.alert('Error', `Product ${i + 1}: description is required`);
        return;
      }
      if (!item.pricePerUnit || parseFloat(item.pricePerUnit) < 1) {
        Alert.alert('Error', `Product ${i + 1}: price must be at least $1`);
        return;
      }
      if (!item.quantity || parseInt(item.quantity) < 1) {
        Alert.alert('Error', `Product ${i + 1}: quantity must be at least 1`);
        return;
      }
    }
    if (!sellerId) {
      Alert.alert('Error', 'Seller is required');
      return;
    }

    const productDescription = lineItems.map(item =>
      `${item.description} - Qty: ${item.quantity} @ $${Number(item.pricePerUnit).toLocaleString()}/unit`
    ).join('\n');

    setLoading(true);
    try {
      const data = await api.initiateEscrow({
        seller_id: sellerId,
        amount: invoiceTotal,
        product_description: productDescription,
        listing_id: listingId || undefined,
        payment_method: paymentMethod,
        fee_payer: feePayer,
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

      {/* Line Items */}
      {lineItems.map((item, index) => (
        <View key={index} style={styles.lineItemCard}>
          <View style={styles.lineItemHeader}>
            <Text style={styles.lineItemLabel}>Product {lineItems.length > 1 ? index + 1 : ''}</Text>
            {lineItems.length > 1 && (
              <TouchableOpacity onPress={() => removeLineItem(index)}>
                <Text style={styles.removeLink}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <Input
            label="Description"
            placeholder="e.g., iPhone 15 Pro Max 256GB, sealed"
            value={item.description}
            onChangeText={val => updateLineItem(index, 'description', val)}
          />
          <View style={styles.priceQtyRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Price Per Unit ($)"
                placeholder="0.00"
                value={item.pricePerUnit}
                onChangeText={val => updateLineItem(index, 'pricePerUnit', val)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 0.5 }}>
              <Input
                label="Qty"
                placeholder="1"
                value={item.quantity}
                onChangeText={val => updateLineItem(index, 'quantity', val)}
                keyboardType="number-pad"
              />
            </View>
          </View>
          {(parseFloat(item.pricePerUnit) > 0 && parseInt(item.quantity) > 0) && (
            <Text style={styles.lineSubtotal}>
              Subtotal: ${(parseFloat(item.pricePerUnit) * parseInt(item.quantity)).toLocaleString()}
            </Text>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.addProductBtn} onPress={addLineItem}>
        <Text style={styles.addProductText}>+ Add More Product</Text>
      </TouchableOpacity>

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

      {/* Who pays escrow fee */}
      <Text style={styles.fieldLabel}>Who Pays the Escrow Fee?</Text>
      <View style={styles.paymentRow}>
        <TouchableOpacity
          style={[styles.feePayerOption, feePayer === 'buyer' && styles.feePayerActive]}
          onPress={() => setFeePayer('buyer')}
        >
          <Text style={[styles.feePayerText, feePayer === 'buyer' && styles.feePayerTextActive]}>Buyer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feePayerOption, feePayer === 'seller' && styles.feePayerActive]}
          onPress={() => setFeePayer('seller')}
        >
          <Text style={[styles.feePayerText, feePayer === 'seller' && styles.feePayerTextActive]}>Seller</Text>
        </TouchableOpacity>
      </View>

      {invoiceTotal > 0 ? (
        <View style={styles.feeCard}>
          {lineItems.map((item, index) => {
            const sub = itemSubtotals[index];
            if (!sub) return null;
            return (
              <View key={index} style={styles.feeRow}>
                <Text style={styles.feeLabel} numberOfLines={1}>
                  {item.description || `Product ${index + 1}`} ({item.quantity}x)
                </Text>
                <Text style={styles.feeValue}>${sub.toLocaleString()}</Text>
              </View>
            );
          })}
          {lineItems.length > 1 && (
            <View style={[styles.feeRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4, marginTop: 4 }]}>
              <Text style={[styles.feeLabel, { fontWeight: '600' }]}>Invoice Total</Text>
              <Text style={[styles.feeValue, { fontWeight: '600' }]}>${invoiceTotal.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Escrow Fee ({getFeeLabel(invoiceTotal)})</Text>
            <Text style={styles.feeValue}>${escrowFee.toFixed(2)}</Text>
          </View>
          {buyerFee > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>  Buyer's share</Text>
              <Text style={styles.feeValue}>${buyerFee.toFixed(2)}</Text>
            </View>
          )}
          {sellerFee > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>  Deducted from seller</Text>
              <Text style={[styles.feeValue, { color: colors.error }]}>-${sellerFee.toFixed(2)}</Text>
            </View>
          )}
          {paymentMethod === 'wire' && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Wire Transfer Fee</Text>
              <Text style={styles.feeValue}>${wireFee.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.feeRow, styles.feeTotalRow]}>
            <Text style={styles.feeTotalLabel}>Buyer Pays</Text>
            <Text style={styles.feeTotalValue}>${buyerTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Seller Receives</Text>
            <Text style={[styles.feeValue, { color: colors.success }]}>${sellerPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.feeRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs, marginTop: spacing.xs }]}>
            <Text style={styles.feeLabel}>Seller Security Deposit</Text>
            <Text style={[styles.feeValue, { color: colors.warning }]}>${sellerDeposit.toFixed(2)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs }}>
            All products must be EXPRESS shipped to our warehouse for inspection before delivery to buyer. Seller deposit is returned if product matches listing. Forfeited if product is fake or doesn't match.
          </Text>
        </View>
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
  lineItemCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  lineItemLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  removeLink: { fontSize: 14, fontWeight: '600', color: colors.error },
  lineSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'right',
    marginTop: -spacing.xs,
  },
  addProductBtn: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addProductText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  priceQtyRow: { flexDirection: 'row', alignItems: 'flex-start' },
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
  feePayerOption: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  feePayerActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feePayerText: { fontSize: 14, fontWeight: '600', color: colors.text },
  feePayerTextActive: { color: '#fff' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 15 },
  feeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  feeLabel: { fontSize: 14, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  feeValue: { fontSize: 14, fontWeight: '500', color: colors.text },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  feeTotalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  feeTotalValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
