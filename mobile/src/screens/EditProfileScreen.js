import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

export default function EditProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    business_name: user?.business_name || '',
    city: user?.city || '',
    category: user?.category || '',
    bio: user?.bio || '',
  });
  const [loading, setLoading] = useState(false);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.business_name || !form.city) {
      Alert.alert('Error', 'Business name and city are required');
      return;
    }
    setLoading(true);
    try {
      await api.updateProfile(form);
      await refreshUser();
      Alert.alert('Success', 'Profile updated');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="business-outline" size={22} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Keep your business details up to date</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Input
          label="Business Name"
          value={form.business_name}
          onChangeText={v => updateField('business_name', v)}
        />
        <Input
          label="City"
          value={form.city}
          onChangeText={v => updateField('city', v)}
        />
        <Input
          label="Category"
          value={form.category}
          onChangeText={v => updateField('category', v)}
        />
        <Input
          label="Bio"
          value={form.bio}
          onChangeText={v => updateField('bio', v)}
          multiline
          numberOfLines={4}
          style={{ marginBottom: 0 }}
        />
      </View>

      <Button title="Save Changes" onPress={handleSave} loading={loading} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.actionSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
});
