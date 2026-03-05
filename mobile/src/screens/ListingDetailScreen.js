import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function ListingDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadListing();
  }, [id]);

  async function loadListing() {
    try {
      const data = await api.getListing(id);
      setListing(data.listing);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete Listing', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteListing(id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  function handleContact() {
    if (listing.user_phone) {
      Linking.openURL(`tel:${listing.user_phone}`);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text>Listing not found</Text>
      </View>
    );
  }

  const isOwner = user && user.id === listing.user_id;
  const isWTS = listing.type === 'WTS';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: isWTS ? colors.wts : colors.wtb }]}>
          <Text style={styles.badgeText}>{isWTS ? 'For Sale' : 'Want to Buy'}</Text>
        </View>
        {listing.is_featured && (
          <View style={[styles.badge, { backgroundColor: colors.highlight }]}>
            <Text style={styles.badgeText}>Featured</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{listing.title}</Text>

      {listing.price && (
        <Text style={styles.price}>${Number(listing.price).toLocaleString()}</Text>
      )}

      <View style={styles.detailsGrid}>
        <DetailItem label="Quantity" value={listing.quantity} />
        <DetailItem label="Condition" value={listing.condition} />
        <DetailItem label="Category" value={listing.category} />
        <DetailItem label="City" value={listing.city} />
      </View>

      {listing.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posted By</Text>
        <View style={styles.sellerCard}>
          <Text style={styles.sellerName}>{listing.business_name}</Text>
          <Text style={styles.sellerCity}>{listing.user_city}</Text>
          {listing.rating_score > 0 && (
            <Text style={styles.sellerRating}>
              {'★'.repeat(Math.round(Number(listing.rating_score)))} {Number(listing.rating_score).toFixed(1)} ({listing.rating_count} reviews)
            </Text>
          )}

          <View style={styles.sellerActions}>
            <Button
              title="View Profile"
              variant="outline"
              onPress={() => navigation.navigate('UserProfile', { id: listing.user_id })}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            {!isOwner && (
              <Button
                title="Message"
                onPress={() => navigation.navigate('Chat', { userId: listing.user_id, name: listing.business_name })}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </View>

      {!isOwner && listing.user_phone && (
        <Button
          title={`Call ${listing.user_phone}`}
          onPress={handleContact}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {isOwner && (
        <View style={styles.ownerActions}>
          <Button
            title="Edit Listing"
            variant="outline"
            onPress={() => navigation.navigate('CreateListing', { listing })}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <Button
            title="Delete"
            variant="danger"
            onPress={handleDelete}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <Text style={styles.date}>
        Posted {new Date(listing.created_at).toLocaleDateString()}
      </Text>
    </ScrollView>
  );
}

function DetailItem({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    width: '50%',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sellerCity: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sellerRating: {
    fontSize: 14,
    color: colors.star,
    marginTop: spacing.xs,
  },
  sellerActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  ownerActions: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  date: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
  },
});
