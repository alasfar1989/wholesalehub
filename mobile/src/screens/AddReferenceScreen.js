import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

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
      <Input label="Reference Name" placeholder="Full name" value={name} onChangeText={setName} />
      <Input label="Phone Number" placeholder="+1234567890" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button title="Add Reference" onPress={handleAdd} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
});
