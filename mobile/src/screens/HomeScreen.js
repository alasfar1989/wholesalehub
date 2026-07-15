import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import SkeletonCard from '../components/SkeletonCard';
import { colors, spacing, radius } from '../utils/theme';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [featured, setFeatured] = useState({ wts: [], wtb: [] });
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setRefreshing(true);
    try {
      const [featuredData, listingsData, convoData] = await Promise.all([
        api.getFeatured(),
        api.getListings(1),
        api.getConversations().catch(() => ({ conversations: [] })),
      ]);
      setFeatured(featuredData.featured);
      setListings(listingsData.listings);
      setPage(1);
      setHasMore(listingsData.pagination.page < listingsData.pagination.pages);
      const totalUnread = (convoData.conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setUnreadCount(totalUnread);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore) return;
    try {
      const nextPage = page + 1;
      const data = await api.getListings(nextPage);
      setListings(prev => [...prev, ...data.listings]);
      setPage(nextPage);
      setHasMore(data.pagination.page < data.pagination.pages);
    } catch (err) {
      console.error(err);
    }
  }

  function renderHeader() {
    return (
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Ionicons name="cube" size={16} color={colors.primary} />
              </View>
              <Text style={styles.logo}>WholesaleHub</Text>
            </View>
            <Text style={styles.greeting} numberOfLines={1}>
              Welcome, {user?.business_name || 'trader'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.headerBtn}>
            <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={18} color={colors.textLight} />
          <Text style={styles.searchPlaceholder}>Search listings, sellers, locations…</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderFeaturedSection() {
    const hasFeatured = featured.wts.length > 0 || featured.wtb.length > 0;
    if (!hasFeatured) return null;

    return (
      <View style={styles.featuredSection}>
        <Text style={styles.sectionTitle}>Featured Listings</Text>
        {featured.wts.length > 0 && (
          <>
            <Text style={styles.subTitle}>For Sale</Text>
            {featured.wts.map(item => (
              <ListingCard
                key={item.id}
                listing={item}
                onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
              />
            ))}
          </>
        )}
        {featured.wtb.length > 0 && (
          <>
            <Text style={styles.subTitle}>Want to Buy</Text>
            {featured.wtb.map(item => (
              <ListingCard
                key={item.id}
                listing={item}
                onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
              />
            ))}
          </>
        )}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>All Listings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {loading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
          )}
          ListHeaderComponent={renderFeaturedSection}
          ListEmptyComponent={
            !refreshing && (
              <View style={styles.emptyContainer}>
                <Ionicons name="storefront-outline" size={48} color={colors.textLight} />
                <Text style={styles.emptyTitle}>No Listings Yet</Text>
                <Text style={styles.empty}>Be the first to post a listing!</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.action} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  headerBtn: { position: 'relative', padding: spacing.xs },
  unreadBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: colors.highlight, borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.primary,
  },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  searchPlaceholder: {
    color: colors.textLight,
    fontSize: 14,
  },
  skeletonWrap: {
    paddingTop: spacing.md,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  featuredSection: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
  },
});
