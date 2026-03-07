import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function InitiateEscrowScreen({ route, navigation }) {
  const prefill = route.params || {};
  const { user } = useAuth();

  const [step, setStep] = useState(prefill.sellerId ? 'form' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);

  const [sellerId, setSellerId] = useState(prefill.sellerId || '');
  const [sellerName, setSellerName] = useState(prefill.sellerName || '');
  const [listingId, setListingId] = useState(prefill.listingId || '');
  const [amount, setAmount] = useState(prefill.amount || '');
  const [description, setDescription] = useState(prefill.description || '');
  const [loading, setLoading] = useState(false);

  async function handleSearch(text) {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await api.searchListings({ keyword: text });
      // Filter out own listings
      setSearchResults((data.listings || []).filter(l => l.user_id !== user.id));
    } catch (err) {
      console.error(err);
    }
  }

  function selectListing(listing) {
    setSelectedListing(listing);
    setSellerId(listing.user_id);
    setSellerName(listing.business_name);
    setListingId(listing.id);
    setDescription(`${listing.title} - Qty: ${listing.quantity}`);
    setAmount(listing.price ? String(listing.price) : '');
    setStep('form');
  }

  function clearSelection() {
    setSelectedListing(null);
    setSellerId('');
    setSellerName('');
    setListingId('');
    setDescription('');
    setAmount('');
    setSearchQuery('');
    setSearchResults([]);
    setStep('search');
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

  if (step === 'search') {
    return (
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <Text style={styles.stepTitle}>Select a Listing</Text>
          <Text style={styles.stepHint}>Search for the WTS or WTB listing you want to escrow</Text>
          <Input
            placeholder="Search listings..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.listingItem} onPress={() => selectListing(item)}>
              <View style={styles.listingHeader}>
                <View style={[styles.typeBadge, { backgroundColor: item.type === 'WTS' ? colors.wts : colors.wtb }]}>
                  <Text style={styles.typeBadgeText}>{item.type}</Text>
                </View>
                <Text style={styles.listingPrice}>
                  {item.price ? `$${Number(item.price).toLocaleString()}` : 'DM for price'}
                </Text>
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.listingSub}>
                {item.business_name} - {item.city} - Qty: {item.quantity}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchQuery.length >= 2 ? (
              <Text style={styles.empty}>No listings found</Text>
            ) : (
              <Text style={styles.empty}>Type to search for a listing</Text>
            )
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Selected listing summary */}
      {selectedListing && (
        <View style={styles.selectedCard}>
          <View style={styles.listingHeader}>
            <View style={[styles.typeBadge, { backgroundColor: selectedListing.type === 'WTS' ? colors.wts : colors.wtb }]}>
              <Text style={styles.typeBadgeText}>{selectedListing.type}</Text>
            </View>
            <TouchableOpacity onPress={clearSelection}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedTitle}>{selectedListing.title}</Text>
          <Text style={styles.selectedSub}>{sellerName} - Qty: {selectedListing.quantity}</Text>
        </View>
      )}

      {!selectedListing && sellerName && (
        <View>
          <Input label="Seller" value={sellerName} editable={false} />
        </View>
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
  searchHeader: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  stepHint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  listContent: { paddingBottom: spacing.xl },
  listingItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  listingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listingPrice: { fontSize: 15, fontWeight: '700', color: colors.primary },
  listingSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  selectedCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4 },
  selectedSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  changeLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 15 },
});
