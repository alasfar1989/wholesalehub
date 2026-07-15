import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../utils/theme';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ListingCard({ listing, onPress, showStats }) {
  const isWTS = listing.type === 'WTS';

  return (
    <TouchableOpacity
      style={[styles.card, listing.is_featured && styles.cardFeatured]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {listing.thumbnail && (
        <Image
          source={{ uri: listing.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
      {showStats && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.statText}>{listing.view_count || 0} views</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={15} color={colors.highlight} />
            <Text style={styles.statText}>{listing.favorite_count || 0} saved</Text>
          </View>
        </View>
      )}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: isWTS ? colors.wtsSoft : colors.wtbSoft }]}>
          <View style={[styles.badgeDot, { backgroundColor: isWTS ? colors.wtsText : colors.wtbText }]} />
          <Text style={[styles.badgeText, { color: isWTS ? colors.wtsText : colors.wtbText }]}>
            {listing.type}
          </Text>
        </View>
        {listing.is_featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>★ Featured</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>

      <Text style={styles.price}>
        {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
      </Text>

      <View style={styles.meta}>
        {listing.quantity > 1 && (
          listing.quantity_sold > 0 ? (
            <Text style={[styles.metaText, styles.soldMeta]}>
              {listing.quantity_sold} of {listing.quantity} sold
            </Text>
          ) : (
            <Text style={styles.metaText}>Qty: {listing.quantity}</Text>
          )
        )}
        <Text style={styles.metaText}>{listing.condition}</Text>
        <Text style={styles.metaText}>{listing.city}</Text>
      </View>

      <View style={styles.seller}>
        <View style={styles.sellerInfo}>
          {listing.business_name && (
            <>
              {listing.user_avatar ? (
                <Image source={{ uri: listing.user_avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarFallback}>
                  <Text style={styles.sellerAvatarText}>{listing.business_name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.sellerName}>{listing.business_name}</Text>
            </>
          )}
        </View>
        <View style={styles.sellerRight}>
          {listing.rating_score > 0 && (
            <Text style={styles.rating}>
              {'★'.repeat(Math.round(Number(listing.rating_score)))} {Number(listing.rating_score).toFixed(1)}
            </Text>
          )}
          {listing.created_at && (
            <Text style={styles.timeAgo}>{timeAgo(listing.created_at)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardFeatured: {
    borderColor: colors.highlight,
    backgroundColor: colors.highlightSoft,
  },
  thumbnail: {
    width: '100%',
    height: 170,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  featuredBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
  },
  featuredText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
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
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  soldMeta: {
    color: '#b26a00',
    backgroundColor: '#fff3e0',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
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
  sellerRight: {
    alignItems: 'flex-end',
  },
  rating: {
    fontSize: 13,
    color: colors.star,
  },
  timeAgo: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
});
