import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function PendingApprovalScreen() {
  const { logout, refreshUser } = useAuth();

  async function handleCheckStatus() {
    try {
      await refreshUser();
    } catch {}
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Pending Approval</Text>
        <Text style={styles.message}>
          Your account is being reviewed by the admin. You'll receive a notification once approved.
        </Text>
        <Text style={styles.hint}>
          This usually takes a few hours.
        </Text>

        <Button
          title="Check Status"
          onPress={handleCheckStatus}
          style={{ marginTop: spacing.lg, width: '100%' }}
        />
        <Button
          title="Logout"
          variant="outline"
          onPress={logout}
          style={{ marginTop: spacing.sm, width: '100%' }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
