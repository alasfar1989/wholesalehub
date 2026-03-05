import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const CATEGORIES = ['electronics', 'phones', 'laptops', 'tablets', 'accessories', 'components', 'networking', 'other'];

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    phone: '',
    password: '',
    business_name: '',
    city: '',
    category: 'electronics',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSignup() {
    if (!form.phone || !form.password || !form.business_name || !form.city) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signup(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the B2B marketplace</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Input
          label="Phone Number *"
          placeholder="+1234567890"
          value={form.phone}
          onChangeText={v => updateField('phone', v)}
          keyboardType="phone-pad"
        />

        <Input
          label="Password *"
          placeholder="Min 6 characters"
          value={form.password}
          onChangeText={v => updateField('password', v)}
          secureTextEntry
        />

        <Input
          label="Business Name *"
          placeholder="Your company name"
          value={form.business_name}
          onChangeText={v => updateField('business_name', v)}
        />

        <Input
          label="City *"
          placeholder="Your city"
          value={form.city}
          onChangeText={v => updateField('city', v)}
        />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              title={cat}
              variant={form.category === cat ? 'primary' : 'outline'}
              onPress={() => updateField('category', cat)}
              style={styles.chip}
              textStyle={{ fontSize: 13 }}
            />
          ))}
        </ScrollView>

        <Button
          title="Create Account"
          onPress={handleSignup}
          loading={loading}
          style={{ marginTop: spacing.md }}
        />

        <Button
          title="Already have an account? Log in"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  chip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: 14,
  },
});
