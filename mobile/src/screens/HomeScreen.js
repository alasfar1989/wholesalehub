import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import ListingCard from '../components/ListingCard';
import { colors, spacing } from '../utils/theme';

export default function HomeScreen({ navigation }) {
  const [featured, setFeatured] = useState({ wts: [], wtb: [] });
  const [listings, setListings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setRefreshing(true);
    try {
      const [featuredData, listingsData] = await Promise.all([
        api.getFeatured(),
        api.getListings(1),
      ]);
      setFeatured(featuredData.featured);
      setListings(listingsData.listings);
      setPage(1);
      setHasMore(listingsData.pagination.page < listingsData.pagination.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
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
      <View style={styles.header}>
        <Text style={styles.logo}>WholesaleHub</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <Text style={styles.searchIcon}>Search</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.empty}>No listings yet. Be the first to post!</Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  searchIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
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
    marginTop: spacing.sm,
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
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    fontSize: 16,
  },
});
