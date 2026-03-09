import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Keyboard } from 'react-native';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function MarkSoldScreen({ route, navigation }) {
  const { listing } = route.params;
  const [step, setStep] = useState(1); // 1 = search buyer, 2 = rate
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
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
    setLoading(true);
    try {
      await api.createDeal({
        listing_id: listing.id,
        buyer_id: selectedBuyer.id,
        stars: comment.trim() ? stars : undefined,
        comment: comment.trim() || undefined,
      });
      Alert.alert(
        'Deal Recorded!',
        `Listing marked as sold. ${selectedBuyer.business_name} has been added as a reference and notified to rate you.`,
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
                <Text style={styles.userRating}>★ {Number(user.rating_score).toFixed(1)}</Text>
              )}
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
            <Text style={styles.selectedLabel}>Sold to:</Text>
            <Text style={styles.selectedName}>{selectedBuyer.business_name}</Text>
            <Text style={styles.selectedCity}>{selectedBuyer.city}</Text>
            <TouchableOpacity onPress={() => { setSelectedBuyer(null); setStep(1); }}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heading}>Rate this buyer (optional)</Text>
          <Text style={styles.hint}>Leave a review for your experience with this trader</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setStars(s)}>
                <Text style={[styles.starIcon, s <= stars && styles.starActive]}>★</Text>
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
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  listingTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  listingPrice: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  searchingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  userCity: { fontSize: 13, color: colors.textSecondary },
  userRating: { fontSize: 14, color: colors.star, fontWeight: '600' },
  noResults: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.lg, fontSize: 15 },
  selectedCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  selectedLabel: { fontSize: 12, color: '#2e7d32', fontWeight: '500' },
  selectedName: { fontSize: 18, fontWeight: '700', color: '#2e7d32', marginTop: spacing.xs },
  selectedCity: { fontSize: 14, color: '#388e3c' },
  changeLink: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  starIcon: { fontSize: 40, color: colors.border },
  starActive: { color: colors.star },
});
