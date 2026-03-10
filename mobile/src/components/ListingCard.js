import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors, spacing } from '../utils/theme';

export default function ListingCard({ listing, onPress }) {
  const isWTS = listing.type === 'WTS';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: isWTS ? colors.wts : colors.wtb }]}>
          <Text style={styles.badgeText}>{listing.type}</Text>
        </View>
        {listing.is_featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>

      <Text style={styles.price}>
        {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
      </Text>

      <View style={styles.meta}>
        {listing.quantity > 1 && (
          <Text style={styles.metaText}>Qty: {listing.quantity}</Text>
        )}
        <Text style={styles.metaText}>{listing.condition}</Text>
        <Text style={styles.metaText}>{listing.city}</Text>
      </View>

      {listing.business_name && (
        <View style={styles.seller}>
          <View style={styles.sellerInfo}>
            {listing.user_avatar ? (
              <Image source={{ uri: listing.user_avatar }} style={styles.sellerAvatar} />
            ) : (
              <View style={styles.sellerAvatarFallback}>
                <Text style={styles.sellerAvatarText}>{listing.business_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.sellerName}>{listing.business_name}</Text>
          </View>
          {listing.rating_score > 0 && (
            <Text style={styles.rating}>
              {'★'.repeat(Math.round(Number(listing.rating_score)))} {Number(listing.rating_score).toFixed(1)}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  featuredBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.highlight,
  },
  featuredText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seller: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sellerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: spacing.xs,
  },
  sellerAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  sellerAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  sellerName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rating: {
    fontSize: 13,
    color: colors.star,
  },
});
