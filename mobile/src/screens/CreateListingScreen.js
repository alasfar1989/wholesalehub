import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const CONDITIONS = ['new', 'like new', 'good', 'fair', 'refurbished'];
const CATEGORIES = ['electronics', 'phones', 'laptops', 'tablets', 'accessories', 'components', 'networking', 'other'];

export default function CreateListingScreen({ route, navigation }) {
  const { user } = useAuth();
  const editListing = route.params?.listing;
  const isEdit = !!editListing;

  const [form, setForm] = useState({
    type: editListing?.type || 'WTS',
    title: editListing?.title || '',
    description: editListing?.description || '',
    price: editListing?.price ? String(editListing.price) : '',
    quantity: editListing?.quantity ? String(editListing.quantity) : '1',
    condition: editListing?.condition || 'new',
    category: editListing?.category || 'electronics',
    city: editListing?.city || user?.city || '',
  });
  const [loading, setLoading] = useState(false);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.title || !form.city) {
      Alert.alert('Error', 'Title and city are required');
      return;
    }

    setLoading(true);
    try {
      const body = {
        ...form,
        price: form.price ? parseFloat(form.price) : undefined,
        quantity: parseInt(form.quantity) || 1,
      };

      if (isEdit) {
        await api.updateListing(editListing.id, body);
        Alert.alert('Success', 'Listing updated');
      } else {
        await api.createListing(body);
        Alert.alert('Success', 'Listing created');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{isEdit ? 'Edit Listing' : 'Create Listing'}</Text>

      {/* Type toggle */}
      <Text style={styles.label}>Listing Type</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, form.type === 'WTS' && styles.toggleActiveWTS]}
          onPress={() => updateField('type', 'WTS')}
        >
          <Text style={[styles.toggleText, form.type === 'WTS' && styles.toggleTextActive]}>
            Want to Sell
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, form.type === 'WTB' && styles.toggleActiveWTB]}
          onPress={() => updateField('type', 'WTB')}
        >
          <Text style={[styles.toggleText, form.type === 'WTB' && styles.toggleTextActive]}>
            Want to Buy
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        label="Title *"
        placeholder="e.g., iPhone 15 Pro Max 256GB"
        value={form.title}
        onChangeText={v => updateField('title', v)}
      />

      <Input
        label="Description"
        placeholder="Details about the product..."
        value={form.description}
        onChangeText={v => updateField('description', v)}
        multiline
        numberOfLines={4}
        style={{ height: undefined }}
      />

      <View style={styles.row}>
        <Input
          label={form.type === 'WTS' ? 'Price ($)' : 'Budget ($)'}
          placeholder="0.00"
          value={form.price}
          onChangeText={v => updateField('price', v)}
          keyboardType="decimal-pad"
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Input
          label="Quantity"
          placeholder="1"
          value={form.quantity}
          onChangeText={v => updateField('quantity', v)}
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
      </View>

      <Text style={styles.label}>Condition</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {CONDITIONS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, form.condition === c && styles.chipActive]}
            onPress={() => updateField('condition', c)}
          >
            <Text style={[styles.chipText, form.condition === c && styles.chipTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, form.category === c && styles.chipActive]}
            onPress={() => updateField('category', c)}
          >
            <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Input
        label="City *"
        placeholder="Your city"
        value={form.city}
        onChangeText={v => updateField('city', v)}
      />

      <Button
        title={isEdit ? 'Update Listing' : 'Post Listing'}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
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
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  toggle: {
    flex: 1,
    padding: spacing.sm + 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleActiveWTS: {
    backgroundColor: colors.wts,
    borderColor: colors.wts,
  },
  toggleActiveWTB: {
    backgroundColor: colors.wtb,
    borderColor: colors.wtb,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  toggleTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  chips: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#fff',
  },
});
