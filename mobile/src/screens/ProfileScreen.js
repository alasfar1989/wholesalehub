import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing } from '../utils/theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const [listings, setListings] = useState([]);
  const [references, setReferences] = useState([]);
  const [tab, setTab] = useState('listings');

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadData();
        refreshUser();
      }
    }, [user?.id])
  );

  async function loadData() {
    try {
      const [listingsData, refsData] = await Promise.all([
        api.getMyListings(),
        api.getReferences(user.id),
      ]);
      setListings(listingsData.listings);
      setReferences(refsData.references);
    } catch (err) {
      console.error(err);
    }
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.business_name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.business_name}</Text>
        <Text style={styles.info}>{user?.city} - {user?.category}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>

        {user?.rating_score > 0 && (
          <Text style={styles.rating}>
            {'★'.repeat(Math.round(Number(user.rating_score)))} {Number(user.rating_score).toFixed(1)} ({user.rating_count} reviews)
          </Text>
        )}

        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.actions}>
          <Button
            title="Edit Profile"
            variant="outline"
            onPress={() => navigation.navigate('EditProfile')}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <Button
            title="Logout"
            variant="danger"
            onPress={handleLogout}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton title={`Listings (${listings.length})`} active={tab === 'listings'} onPress={() => setTab('listings')} />
        <TabButton title={`References (${references.length})`} active={tab === 'references'} onPress={() => setTab('references')} />
      </View>

      {tab === 'listings' && (
        <>
          {listings.map(item => (
            <ListingCard
              key={item.id}
              listing={item}
              onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
          ))}
          {listings.length === 0 && <Text style={styles.empty}>No listings yet</Text>}
        </>
      )}

      {tab === 'references' && (
        <>
          <Button
            title="Add Reference"
            variant="outline"
            onPress={() => navigation.navigate('AddReference')}
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}
          />
          {references.map(ref => (
            <View key={ref.id} style={styles.refCard}>
              <Text style={styles.refName}>{ref.reference_name}</Text>
              <Text style={styles.refPhone}>{ref.reference_phone}</Text>
            </View>
          ))}
          {references.length === 0 && <Text style={styles.empty}>No references yet</Text>}
        </>
      )}
    </ScrollView>
  );
}

function TabButton({ title, active, onPress }) {
  return (
    <Button
      title={title}
      variant={active ? 'primary' : 'outline'}
      onPress={onPress}
      style={{ flex: 1, marginHorizontal: spacing.xs, minHeight: 40 }}
      textStyle={{ fontSize: 13 }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  profileCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  info: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  phone: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  rating: {
    fontSize: 15,
    color: colors.star,
    marginTop: spacing.sm,
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    width: '100%',
  },
  tabs: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  refCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  refName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  refPhone: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    fontSize: 14,
  },
});
