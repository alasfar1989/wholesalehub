import React, { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const CONDITIONS = ['new', 'A stock', 'B stock', 'A/B stock', 'C stock', 'broken', 'refurbished'];
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
    dmForPrice: editListing ? !editListing.price : false,
  });
  const [photos, setPhotos] = useState([]); // local URIs for new photos
  const [existingPhotos, setExistingPhotos] = useState(editListing?.photos || []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function pickPhotos() {
    const totalCount = photos.length + existingPhotos.length;
    if (totalCount >= 5) {
      Alert.alert('Limit', 'Maximum 5 photos per listing');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - totalCount,
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  }

  function removeNewPhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function removeExistingPhoto(photo) {
    try {
      await api.deleteListingPhoto(editListing.id, photo.id);
      setExistingPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
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

      let listingId;
      if (isEdit) {
        await api.updateListing(editListing.id, body);
        listingId = editListing.id;
      } else {
        const result = await api.createListing(body);
        listingId = result.listing.id;
      }

      // Upload new photos if any
      if (photos.length > 0) {
        setUploading(true);
        try {
          await api.uploadListingPhotos(listingId, photos);
        } catch (err) {
          Alert.alert('Warning', 'Listing saved but some photos failed to upload');
        }
        setUploading(false);
      }

      Alert.alert('Success', isEdit ? 'Listing updated' : 'Listing created');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPhotos = photos.length + existingPhotos.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{isEdit ? 'Edit Listing' : 'Create Listing'}</Text>

      {/* Photos */}
      <Text style={styles.label}>Photos (optional, up to 5)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
        {existingPhotos.map(photo => (
          <View key={photo.id} style={styles.photoThumb}>
            <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => removeExistingPhoto(photo)}>
              <Text style={styles.photoRemoveText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.map((uri, i) => (
          <View key={`new-${i}`} style={styles.photoThumb}>
            <Image source={{ uri }} style={styles.photoImage} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => removeNewPhoto(i)}>
              <Text style={styles.photoRemoveText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
        {totalPhotos < 5 && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhotos}>
            <Text style={styles.addPhotoIcon}>+</Text>
            <Text style={styles.addPhotoText}>Add</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Input
            label={form.type === 'WTS' ? 'Price ($)' : 'Budget ($)'}
            placeholder="0.00"
            value={form.price}
            onChangeText={v => updateField('price', v)}
            keyboardType="decimal-pad"
            editable={!form.dmForPrice}
          />
          <TouchableOpacity
            style={styles.dmToggle}
            onPress={() => {
              const next = !form.dmForPrice;
              updateField('dmForPrice', next);
              if (next) updateField('price', '');
            }}
          >
            <View style={[styles.checkbox, form.dmForPrice && styles.checkboxActive]}>
              {form.dmForPrice && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.dmText}>DM for price</Text>
          </TouchableOpacity>
        </View>
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

      {uploading && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.uploadingText}>Uploading photos...</Text>
        </View>
      )}

      <Button
        title={isEdit ? 'Update Listing' : 'Post Listing'}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 120 },
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  photoRow: { flexDirection: 'row', marginBottom: spacing.md },
  photoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: spacing.sm, position: 'relative' },
  photoImage: { width: 80, height: 80, borderRadius: 8 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface,
  },
  addPhotoIcon: { fontSize: 24, color: colors.textSecondary, fontWeight: '300' },
  addPhotoText: { fontSize: 11, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  toggle: {
    flex: 1, padding: spacing.sm + 4, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface,
  },
  toggleActiveWTS: { backgroundColor: colors.wts, borderColor: colors.wts },
  toggleActiveWTB: { backgroundColor: colors.wtb, borderColor: colors.wtb },
  toggleText: { fontSize: 15, fontWeight: '600', color: colors.text },
  toggleTextActive: { color: '#fff' },
  row: { flexDirection: 'row' },
  dmToggle: { flexDirection: 'row', alignItems: 'center', marginTop: -4, marginBottom: spacing.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    borderColor: colors.border, marginRight: spacing.xs, justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dmText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chips: { flexDirection: 'row', marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  uploadingText: { marginLeft: spacing.sm, color: colors.textSecondary, fontSize: 14 },
});
