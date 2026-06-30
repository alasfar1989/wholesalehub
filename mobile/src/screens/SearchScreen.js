import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing, radius, shadows } from '../utils/theme';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 8;

const TYPE_OPTIONS = [
  { key: '', label: 'All' },
  { key: 'WTS', label: 'WTS' },
  { key: 'WTB', label: 'WTB' },
];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_low', label: 'Price: Low' },
  { key: 'price_high', label: 'Price: High' },
];
const CONDITION_OPTIONS = [
  { key: '', label: 'Any' },
  { key: 'new', label: 'New' },
  { key: 'used', label: 'Used' },
  { key: 'refurbished', label: 'Refurbished' },
];

export default function SearchScreen({ navigation }) {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState('newest');
  const [history, setHistory] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const advancedCount = [city, category, condition, minPrice, maxPrice].filter(Boolean).length;

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }

  async function saveToHistory(term) {
    if (!term.trim()) return;
    try {
      const updated = [term.trim(), ...history.filter(h => h !== term.trim())].slice(0, MAX_HISTORY);
      setHistory(updated);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  }

  async function clearHistory() {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }

  // Accepts overrides so chips can search with their new value without waiting for state.
  async function runSearch(overrides = {}) {
    const f = { keyword, type, city, category, condition, minPrice, maxPrice, sort, ...overrides };
    setLoading(true);
    setSearched(true);
    if (f.keyword) saveToHistory(f.keyword);
    try {
      const params = {};
      if (f.keyword) params.keyword = f.keyword;
      if (f.type) params.type = f.type;
      if (f.city) params.city = f.city;
      if (f.category) params.category = f.category;
      if (f.condition) params.condition = f.condition;
      if (f.minPrice) params.min_price = f.minPrice;
      if (f.maxPrice) params.max_price = f.maxPrice;
      params.sort = f.sort;

      const data = await api.searchListings(params);
      setResults(data.listings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setType(''); setCity(''); setCategory(''); setCondition('');
    setMinPrice(''); setMaxPrice(''); setSort('newest');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerArea}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, brands…"
              placeholderTextColor={colors.textLight}
              value={keyword}
              onChangeText={setKeyword}
              returnKeyType="search"
              onSubmitEditing={() => runSearch()}
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={() => setKeyword('')}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, (showFilters || advancedCount > 0) && styles.filterBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="options-outline" size={20} color={showFilters || advancedCount > 0 ? '#fff' : colors.text} />
            {advancedCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{advancedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {TYPE_OPTIONS.map(opt => (
            <Chip
              key={`t-${opt.key}`}
              label={opt.label}
              active={type === opt.key}
              onPress={() => { setType(opt.key); runSearch({ type: opt.key }); }}
            />
          ))}
          <View style={styles.chipDivider} />
          {SORT_OPTIONS.map(opt => (
            <Chip
              key={`s-${opt.key}`}
              label={opt.label}
              icon={sort === opt.key ? 'swap-vertical' : null}
              active={sort === opt.key}
              onPress={() => { setSort(opt.key); runSearch({ sort: opt.key }); }}
            />
          ))}
        </ScrollView>

        {/* Advanced filters (collapsible) */}
        {showFilters && (
          <View style={styles.advancedPanel}>
            <Text style={styles.advLabel}>Condition</Text>
            <View style={styles.condRow}>
              {CONDITION_OPTIONS.map(opt => (
                <Chip
                  key={`c-${opt.key}`}
                  label={opt.label}
                  active={condition === opt.key}
                  onPress={() => setCondition(opt.key)}
                  style={{ marginBottom: spacing.sm }}
                />
              ))}
            </View>

            <View style={styles.row}>
              <Input placeholder="City" value={city} onChangeText={setCity}
                style={{ flex: 1, marginRight: spacing.sm }} />
              <Input placeholder="Category" value={category} onChangeText={setCategory}
                style={{ flex: 1 }} />
            </View>
            <View style={styles.row}>
              <Input placeholder="Min Price" value={minPrice} onChangeText={setMinPrice}
                keyboardType="numeric" style={{ flex: 1, marginRight: spacing.sm }} />
              <Input placeholder="Max Price" value={maxPrice} onChangeText={setMaxPrice}
                keyboardType="numeric" style={{ flex: 1 }} />
            </View>

            <View style={styles.advActions}>
              <Button
                title="Reset"
                variant="outline"
                onPress={resetFilters}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Apply Filters"
                onPress={() => { setShowFilters(false); runSearch(); }}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
          />
        )}
        ListHeaderComponent={
          searched && !loading ? (
            <Text style={styles.resultCount}>
              {results.length} listing{results.length !== 1 ? 's' : ''} found
            </Text>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>Searching…</Text>
            </View>
          ) : searched ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.empty}>Try different keywords or filters</Text>
            </View>
          ) : history.length > 0 ? (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.historyClear}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.historyChips}>
                {history.map((term, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.historyChip}
                    onPress={() => { setKeyword(term); runSearch({ keyword: term }); }}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.historyChipText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>Find Wholesale Deals</Text>
              <Text style={styles.empty}>Search or tap a filter to browse listings</Text>
            </View>
          )
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, icon, style }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <Ionicons name={icon} size={13} color="#fff" style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerArea: {
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  filterCountBadge: {
    position: 'absolute',
    top: -5, right: -5,
    backgroundColor: colors.highlight,
    minWidth: 18, height: 18,
    borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.surface,
  },
  filterCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  advancedPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  advLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  condRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  advActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  resultCount: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  historySection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  historyClear: {
    fontSize: 13,
    color: colors.action,
    fontWeight: '600',
  },
  historyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    gap: 5,
  },
  historyChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
