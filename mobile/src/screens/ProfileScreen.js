import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Alert, TouchableOpacity, Image, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing } from '../utils/theme';

const BADGE_CONFIG = {
  founder: { label: 'Verified Owner', bg: '#e8f5e9', text: '#2e7d32' },
  top_rated: { label: 'Top Rated', bg: '#fff8e1', text: '#f57f17' },
  trusted: { label: 'Trusted Trader', bg: '#e3f2fd', text: '#1565c0' },
  active: { label: 'Active Seller', bg: '#f3e5f5', text: '#7b1fa2' },
  rising: { label: 'Rising Star', bg: '#e0f7fa', text: '#00838f' },
};

function badgeLabel(badge) {
  return BADGE_CONFIG[badge]?.label || badge;
}
function badgeStyle(badge) {
  const c = BADGE_CONFIG[badge];
  return c ? { backgroundColor: c.bg } : {};
}
function badgeTextStyle(badge) {
  const c = BADGE_CONFIG[badge];
  return c ? { color: c.text } : {};
}

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const [listings, setListings] = useState([]);
  const [references, setReferences] = useState([]);
  const [tab, setTab] = useState('listings');
  const [refreshing, setRefreshing] = useState(false);

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

  async function handleAvatarPick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      try {
        await api.uploadAvatar(result.assets[0].uri);
        await refreshUser();
      } catch (err) {
        Alert.alert('Error', err.message);
      }
    }
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will remove all your data including listings, messages, and references. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Final Confirmation', 'Type DELETE to confirm account deletion.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete My Account',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.deleteMyAccount();
                    logout();
                  } catch (err) {
                    Alert.alert('Error', err.message);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([loadData(), refreshUser()]);
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.profileCard}>
        <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarWrap}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.business_name?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}><Text style={styles.avatarBadgeText}>Edit</Text></View>
        </TouchableOpacity>
        <Text style={styles.name}>{user?.business_name}</Text>
        {user?.badge && (
          <View style={[styles.badge, badgeStyle(user.badge)]}>
            <Text style={[styles.badgeText, badgeTextStyle(user.badge)]}>{badgeLabel(user.badge)}</Text>
          </View>
        )}
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
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:Cpwireless21@gmail.com?subject=WholesaleHub Support')}
          style={styles.supportLink}
        >
          <Text style={styles.supportLinkText}>Help & Support</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteAccount}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
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
            </View>
          ))}
          {references.length === 0 && <Text style={styles.empty}>No references yet</Text>}
        </>
      )}
    </ScrollView>
    </SafeAreaView>
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
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
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
  supportLink: {
    marginTop: spacing.md,
  },
  supportLinkText: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  deleteAccount: {
    marginTop: spacing.sm,
  },
  deleteAccountText: {
    fontSize: 14,
    color: colors.error,
    textDecorationLine: 'underline',
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
