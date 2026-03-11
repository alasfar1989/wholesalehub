import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const CATEGORIES = ['electronics', 'phones', 'laptops', 'tablets', 'accessories', 'components', 'networking', 'other'];

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [step, setStep] = useState(1); // 1 = phone + OTP, 2 = profile details
  const [form, setForm] = useState({
    phone: '',
    password: '',
    business_name: '',
    city: '',
    category: 'electronics',
    referral_phone: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpInputRef = useRef(null);

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSendOtp() {
    if (!form.phone) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.sendOtp(form.phone);
      setOtpSent(true);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length < 4) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.verifyOtp(form.phone, otpCode);
      if (result.verified || result.success) {
        setOtpVerified(true);
        setStep(2);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!form.password || !form.business_name || !form.city || !form.referral_phone) {
      setError('Please fill in all required fields including referral');
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

        {step === 1 ? (
          <>
            <Input
              label="Phone Number *"
              placeholder="+1234567890"
              value={form.phone}
              onChangeText={v => updateField('phone', v)}
              keyboardType="phone-pad"
              editable={!otpSent}
            />

            {!otpSent ? (
              <Button
                title="Send Verification Code"
                onPress={handleSendOtp}
                loading={loading}
                style={{ marginTop: spacing.sm }}
              />
            ) : (
              <>
                <Text style={styles.otpHint}>
                  Enter the 6-digit code sent to {form.phone}
                </Text>
                <TextInput
                  ref={otpInputRef}
                  style={styles.otpInput}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.textLight}
                />
                <Button
                  title="Verify Code"
                  onPress={handleVerifyOtp}
                  loading={loading}
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  title="Resend Code"
                  variant="outline"
                  onPress={handleSendOtp}
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  title="Change Phone Number"
                  variant="outline"
                  onPress={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Phone verified: {form.phone}</Text>
            </View>

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

            <Input
              label="Referral Phone Number *"
              placeholder="Phone # of who referred you"
              value={form.referral_phone}
              onChangeText={v => updateField('referral_phone', v)}
              keyboardType="phone-pad"
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
          </>
        )}

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
  otpHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  otpInput: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  verifiedText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 14,
  },
});
