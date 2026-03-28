import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing } from '../utils/theme';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 8;

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

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    if (keyword) saveToHistory(keyword);
    try {
      const params = {};
      if (keyword) params.keyword = keyword;
      if (type) params.type = type;
      if (city) params.city = city;
      if (category) params.category = category;
      if (condition) params.condition = condition;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      params.sort = sort;

      const data = await api.searchListings(params);
      setResults(data.listings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filters}>
        <Input
          placeholder="Search products..."
          value={keyword}
          onChangeText={setKeyword}
          style={{ marginBottom: spacing.sm }}
        />

        <View style={styles.row}>
          <Input
            placeholder="City"
            value={city}
            onChangeText={setCity}
            style={{ flex: 1, marginRight: spacing.sm, marginBottom: spacing.sm }}
          />
          <Input
            placeholder="Category"
            value={category}
            onChangeText={setCategory}
            style={{ flex: 1, marginBottom: spacing.sm }}
          />
        </View>

        <View style={styles.typeRow}>
          {['', 'WTS', 'WTB'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                {t || 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.typeRow}>
          {['', 'new', 'used', 'refurbished'].map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.typeBtn, condition === c && styles.typeBtnActive]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.typeBtnText, condition === c && styles.typeBtnTextActive]}>
                {c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Any'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.typeRow}>
          {[
            { key: 'newest', label: 'Newest' },
            { key: 'price_low', label: 'Price: Low' },
            { key: 'price_high', label: 'Price: High' },
          ].map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.typeBtn, sort === s.key && styles.typeBtnActive]}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.typeBtnText, sort === s.key && styles.typeBtnTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <Input
            placeholder="Min Price"
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="numeric"
            style={{ flex: 1, marginRight: spacing.sm, marginBottom: spacing.sm }}
          />
          <Input
            placeholder="Max Price"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
            style={{ flex: 1, marginBottom: spacing.sm }}
          />
        </View>

        <Button title="Search" onPress={handleSearch} loading={loading} />

        {!searched && history.length > 0 && (
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
                  onPress={() => { setKeyword(term); }}
                >
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.historyChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
          />
        )}
        ListHeaderComponent={
          searched && !loading ? (
            <Text style={styles.resultCount}>{results.length} listing{results.length !== 1 ? 's' : ''} found</Text>
          ) : null
        }
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.empty}>Try different keywords or filters</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filters: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  resultCount: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
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
    fontWeight: '600',
    color: colors.text,
  },
  historyClear: {
    fontSize: 13,
    color: colors.highlight,
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
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    gap: 4,
  },
  historyChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
