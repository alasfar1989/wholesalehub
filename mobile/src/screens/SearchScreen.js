import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing } from '../utils/theme';

export default function SearchScreen({ navigation }) {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    try {
      const params = {};
      if (keyword) params.keyword = keyword;
      if (type) params.type = type;
      if (city) params.city = city;
      if (category) params.category = category;

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

        <Button title="Search" onPress={handleSearch} loading={loading} />
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
        ListEmptyComponent={
          searched && !loading ? (
            <Text style={styles.empty}>No results found</Text>
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
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    fontSize: 16,
  },
});
