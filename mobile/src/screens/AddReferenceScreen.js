import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

export default function AddReferenceScreen({ navigation }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!name || !phone) {
      Alert.alert('Error', 'Both fields are required');
      return;
    }
    setLoading(true);
    try {
      await api.addReference(user.id, { reference_name: name, reference_phone: phone });
      Alert.alert('Success', 'Reference added');
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
          <Ionicons name="people-outline" size={22} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Add Reference</Text>
          <Text style={styles.subtitle}>Add a trusted trader who can vouch for you</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Input label="Reference Name" placeholder="Full name" value={name} onChangeText={setName} />
        <Input
          label="Phone Number"
          placeholder="+1234567890"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={{ marginBottom: 0 }}
        />
      </View>

      <Button title="Add Reference" onPress={handleAdd} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
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
