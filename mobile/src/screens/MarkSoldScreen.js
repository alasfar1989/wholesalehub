import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

export default function MarkSoldScreen({ route, navigation }) {
  const { listing } = route.params;
  const totalQty = Number(listing.quantity) || 1;
  const alreadySold = Number(listing.quantity_sold) || 0;
  const remaining = Math.max(0, totalQty - alreadySold);
  const hasMultipleUnits = totalQty > 1;
  const [step, setStep] = useState(1); // 1 = search buyer, 2 = rate
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [quantitySold, setQuantitySold] = useState(String(remaining));
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleSearch(q) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.searchUsers(q);
      setSearchResults(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }

  function selectBuyer(buyer) {
    setSelectedBuyer(buyer);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
    setStep(2);
  }

  async function handleSubmit() {
    if (!selectedBuyer) return;
    let qty = remaining;
    if (hasMultipleUnits) {
      const parsed = parseInt(quantitySold, 10);
      if (!parsed || parsed < 1) {
        Alert.alert('Invalid quantity', 'Enter how many units were sold.');
        return;
      }
      if (parsed > remaining) {
        Alert.alert('Too many', `Only ${remaining} unit(s) remaining.`);
        return;
      }
      qty = parsed;
    }
    setLoading(true);
    try {
      await api.createDeal({
        listing_id: listing.id,
        buyer_id: selectedBuyer.id,
        quantity_sold: qty,
        stars: comment.trim() ? stars : undefined,
        comment: comment.trim() || undefined,
      });
      const fullySold = qty >= remaining;
      Alert.alert(
        'Deal Recorded!',
        fullySold
          ? `Listing marked as sold. ${selectedBuyer.business_name} has been added as a reference and notified to rate you.`
          : `${qty} of ${totalQty} unit(s) sold. ${remaining - qty} remaining. ${selectedBuyer.business_name} has been added as a reference.`,
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle}>{listing.title}</Text>
        <Text style={styles.listingPrice}>
          {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
        </Text>
      </View>

      {step === 1 && (
        <>
          <Text style={styles.heading}>Who did you sell to?</Text>
          <Text style={styles.hint}>Search for the buyer by their business name</Text>

          <Input
            placeholder="Search business name..."
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />

          {searching && <Text style={styles.searchingText}>Searching...</Text>}

          {searchResults.map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              activeOpacity={0.85}
              onPress={() => selectBuyer(user)}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{user.business_name?.charAt(0)?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.business_name}</Text>
                <Text style={styles.userCity}>{user.city}</Text>
              </View>
              {user.rating_score > 0 && (
                <View style={styles.userRating}>
                  <Ionicons name="star" size={13} color={colors.star} />
                  <Text style={styles.userRatingText}>{Number(user.rating_score).toFixed(1)}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} style={{ marginLeft: spacing.xs }} />
            </TouchableOpacity>
          ))}

          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <Text style={styles.noResults}>No users found</Text>
          )}
        </>
      )}

      {step === 2 && selectedBuyer && (
        <>
          <View style={styles.selectedCard}>
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.selectedLabel}>Sold to</Text>
            </View>
            <Text style={styles.selectedName}>{selectedBuyer.business_name}</Text>
            <Text style={styles.selectedCity}>{selectedBuyer.city}</Text>
            <TouchableOpacity onPress={() => { setSelectedBuyer(null); setStep(1); }}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          {hasMultipleUnits && (
            <>
              <Text style={styles.heading}>How many units?</Text>
              <Text style={styles.hint}>{remaining} of {totalQty} remaining</Text>
              <Input
                placeholder="Quantity sold"
                value={quantitySold}
                onChangeText={setQuantitySold}
                keyboardType="number-pad"
              />
            </>
          )}

          <Text style={styles.heading}>Rate this buyer (optional)</Text>
          <Text style={styles.hint}>Leave a review for your experience with this trader</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setStars(s)} activeOpacity={0.7}>
                <Ionicons
                  name={s <= stars ? 'star' : 'star-outline'}
                  size={40}
                  color={s <= stars ? colors.star : colors.borderStrong}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Input
            placeholder="How was the deal? (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <Button
            title="Complete Sale"
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />

          <Button
            title="Skip Rating & Complete"
            variant="outline"
            onPress={() => {
              setComment('');
              handleSubmit();
            }}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  listingInfo: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  listingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  listingPrice: { fontSize: 20, fontWeight: '800', color: colors.primary, letterSpacing: -0.3, marginTop: spacing.xs },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.2, marginBottom: spacing.xs },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  searchingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  userCity: { fontSize: 13, color: colors.textSecondary },
  userRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  userRatingText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  noResults: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.lg, fontSize: 15 },
  selectedCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedLabel: { fontSize: 12, color: colors.success, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  selectedName: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  selectedCity: { fontSize: 14, color: colors.textSecondary },
  changeLink: { fontSize: 14, color: colors.action, fontWeight: '600', marginTop: spacing.sm },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
});
