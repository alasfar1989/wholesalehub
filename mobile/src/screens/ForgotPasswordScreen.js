import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput, Alert } from 'react-native';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1 = phone, 2 = OTP, 3 = new password
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpInputRef = useRef(null);

  async function handleSendOtp() {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.sendOtp(phone);
      setStep(2);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndReset() {
    if (!otpCode || otpCode.length < 4) {
      setError('Please enter the verification code');
      return;
    }
    setStep(3);
    setError('');
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(phone, otpCode, newPassword);
      Alert.alert('Success', 'Your password has been reset. Please log in.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {step === 1 && 'Enter your phone number to receive a verification code'}
          {step === 2 && 'Enter the code sent to your phone'}
          {step === 3 && 'Create your new password'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 1 && (
          <>
            <Input
              label="Phone Number"
              placeholder="+1234567890"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Button
              title="Send Verification Code"
              onPress={handleSendOtp}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.otpHint}>Enter the 6-digit code sent to {phone}</Text>
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
              onPress={handleVerifyAndReset}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              title="Resend Code"
              variant="outline"
              onPress={handleSendOtp}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Input
              label="New Password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Input
              label="Confirm New Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        <Button
          title="Back to Login"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.md }}
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
});
