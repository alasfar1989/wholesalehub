import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Alert, TouchableOpacity, Image, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import ListingCard from '../components/ListingCard';
import { colors, spacing, radius, shadows } from '../utils/theme';

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

function Stars({ score, size = 12 }) {
  const rounded = Math.round(Number(score));
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons
          key={n}
          name={n <= rounded ? 'star' : 'star-outline'}
          size={size}
          color={colors.star}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const [listings, setListings] = useState([]);
  const [references, setReferences] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState(0);
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
      const [listingsData, refsData, favsData, blocksData] = await Promise.all([
        api.getMyListings(),
        api.getReferences(user.id),
        api.getFavorites(),
        api.getBlocks().catch(() => ({ blocks: [] })),
      ]);
      setListings(listingsData.listings);
      setExpiringSoon(listingsData.expiring_soon || 0);
      setReferences(refsData.references);
      setFavorites(favsData.listings);
      setBlocks(blocksData.blocks || []);
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

  function handleChangePassword() {
    Alert.prompt('Change Password', 'Enter your current password:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Next',
        onPress: (currentPass) => {
          if (!currentPass) return;
          Alert.prompt('New Password', 'Enter your new password (min 6 characters):', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Next',
              onPress: (newPass) => {
                if (!newPass || newPass.length < 6) {
                  Alert.alert('Error', 'Password must be at least 6 characters');
                  return;
                }
                Alert.prompt('Confirm Password', 'Confirm your new password:', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Change',
                    onPress: async (confirmPass) => {
                      if (newPass !== confirmPass) {
                        Alert.alert('Error', 'Passwords do not match');
                        return;
                      }
                      try {
                        await api.changePassword(currentPass, newPass);
                        Alert.alert('Success', 'Password changed successfully');
                      } catch (err) {
                        Alert.alert('Error', err.message);
                      }
                    },
                  },
                ], 'secure-text');
              },
            },
          ], 'secure-text');
        },
      },
    ], 'secure-text');
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

  const completeMessage =
    !user?.avatar_url && !user?.bio
      ? 'Add a profile photo and bio to build trust'
      : !user?.avatar_url
      ? 'Add a profile photo to build trust'
      : 'Add a bio to complete your profile';

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
      {/* Navy hero header */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarWrap} activeOpacity={0.85}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.business_name?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{user?.business_name}</Text>

        {user?.badge && (
          <View style={[styles.badge, badgeStyle(user.badge)]}>
            <Text style={[styles.badgeText, badgeTextStyle(user.badge)]}>{badgeLabel(user.badge)}</Text>
          </View>
        )}

        <Text style={styles.info}>{user?.city} · {user?.category}</Text>
        {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      {/* Stats card (overlaps the hero) */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {user?.rating_score > 0 ? Number(user.rating_score).toFixed(1) : '—'}
          </Text>
          <Stars score={user?.rating_score || 0} size={11} />
          <Text style={styles.statLabel}>{user?.rating_count || 0} reviews</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{listings.length}</Text>
          <Ionicons name="pricetag-outline" size={14} color={colors.action} />
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{references.length}</Text>
          <Ionicons name="people-outline" size={14} color={colors.action} />
          <Text style={styles.statLabel}>References</Text>
        </View>
      </View>

      {(!user?.avatar_url || !user?.bio) && (
        <View style={styles.completePrompt}>
          <Ionicons name="information-circle-outline" size={18} color={colors.action} />
          <Text style={styles.completePromptText}>{completeMessage}</Text>
        </View>
      )}

      {/* Primary actions */}
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

      {/* Settings menu */}
      <View style={styles.menuCard}>
        <MenuRow
          icon="pricetag-outline"
          label="My Offers"
          onPress={() => navigation.navigate('Offers')}
        />
        <View style={styles.menuDivider} />
        <MenuRow
          icon="notifications-outline"
          label="Saved Searches"
          onPress={() => navigation.navigate('SavedSearches')}
        />
        <View style={styles.menuDivider} />
        <MenuRow
          icon="help-buoy-outline"
          label="Help & Support"
          onPress={() => Linking.openURL('mailto:Cpwireless21@gmail.com?subject=WholesaleHub Support')}
        />
        <View style={styles.menuDivider} />
        <MenuRow
          icon="lock-closed-outline"
          label="Change Password"
          onPress={handleChangePassword}
        />
        <View style={styles.menuDivider} />
        <MenuRow
          icon="trash-outline"
          label="Delete Account"
          onPress={handleDeleteAccount}
          danger
        />
      </View>

      {/* Blocked Users */}
      {blocks.length > 0 && (
        <View style={styles.blockedSection}>
          <TouchableOpacity
            style={styles.blockedHeader}
            onPress={() => setTab(tab === 'blocked' ? 'listings' : 'blocked')}
          >
            <View style={styles.blockedHeaderLeft}>
              <Ionicons name="ban-outline" size={18} color={colors.error} />
              <Text style={styles.blockedHeaderText}>Blocked Users ({blocks.length})</Text>
            </View>
            <Ionicons name={tab === 'blocked' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {tab === 'blocked' && blocks.map(b => (
            <View key={b.blocked_id} style={styles.blockedRow}>
              <Text style={styles.blockedName}>{b.business_name}</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Unblock', `Unblock ${b.business_name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unblock', onPress: async () => {
                      try {
                        await api.unblockUser(b.blocked_id);
                        setBlocks(prev => prev.filter(x => x.blocked_id !== b.blocked_id));
                      } catch (err) { Alert.alert('Error', err.message); }
                    }},
                  ]);
                }}
                style={styles.unblockBtn}
              >
                <Text style={styles.unblockBtnText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <Segment title={`Listings (${listings.length})`} active={tab === 'listings'} onPress={() => setTab('listings')} />
        <Segment title={`Saved (${favorites.length})`} active={tab === 'saved'} onPress={() => setTab('saved')} />
        <Segment title={`Refs (${references.length})`} active={tab === 'references'} onPress={() => setTab('references')} />
      </View>

      {tab === 'listings' && (
        <>
          {expiringSoon > 0 && (
            <View style={styles.expiryWarning}>
              <Ionicons name="time-outline" size={18} color={colors.warning} />
              <Text style={styles.expiryWarningText}>
                {expiringSoon} listing{expiringSoon > 1 ? 's' : ''} expiring within 3 days
              </Text>
            </View>
          )}
          {listings.map(item => (
            <ListingCard
              key={item.id}
              listing={item}
              showStats
              onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
          ))}
          {listings.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="pricetag-outline" size={36} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Listings</Text>
              <Text style={styles.empty}>Create your first listing to start selling</Text>
            </View>
          )}
        </>
      )}

      {tab === 'saved' && (
        <>
          {favorites.map(item => (
            <ListingCard
              key={item.id}
              listing={item}
              onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
          ))}
          {favorites.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="heart-outline" size={36} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Saved Listings</Text>
              <Text style={styles.empty}>Save listings you're interested in</Text>
            </View>
          )}
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
              <Ionicons name="business-outline" size={18} color={colors.action} style={{ marginRight: spacing.sm }} />
              <Text style={styles.refName}>{ref.reference_name}</Text>
            </View>
          ))}
          {references.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={36} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No References</Text>
              <Text style={styles.empty}>Add references to build trust</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, danger && styles.menuIconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.action} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </TouchableOpacity>
  );
}

function Segment({ title, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
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

  hero: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.action,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.action,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  phone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: -spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: colors.textLight, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  completePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.actionSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  completePromptText: {
    flex: 1,
    fontSize: 13,
    color: colors.actionDark,
    fontWeight: '500',
  },

  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
  },
  menuCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.actionSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuIconWrapDanger: {
    backgroundColor: colors.errorSoft,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 34 + spacing.md,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.action },

  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  refName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: -0.2,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
  },

  blockedSection: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  blockedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  blockedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockedHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  blockedName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  unblockBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  unblockBtnText: {
    fontSize: 13,
    color: colors.action,
    fontWeight: '700',
  },

  expiryWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  expiryWarningText: {
    flex: 1,
    fontSize: 14,
    color: colors.warning,
    fontWeight: '600',
  },
});
