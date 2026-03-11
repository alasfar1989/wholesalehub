import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function AdminScreen({ navigation }) {
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [escrowRevenue, setEscrowRevenue] = useState(null);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function loadDashboard() {
    setRefreshing(true);
    try {
      const data = await api.getDashboard();
      setDashboard(data.dashboard);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.getAdminUsers();
      setUsers(data.users);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadListings() {
    try {
      const data = await api.getAdminListings();
      setListings(data.listings);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSuspend(userId, businessName) {
    Alert.alert('Toggle Suspend', `Toggle suspension for ${businessName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await api.toggleSuspend(userId);
            loadUsers();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  async function handleDeleteUser(userId, businessName) {
    Alert.alert('Delete User', `Permanently delete ${businessName}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(userId);
            loadUsers();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  async function handleFeature(listingId) {
    try {
      await api.toggleFeatured(listingId);
      loadListings();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  async function loadEscrows() {
    try {
      const data = await api.getAdminEscrows();
      setEscrows(data.escrows);
      setEscrowRevenue(data.revenue);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadPendingUsers() {
    try {
      const data = await api.getPendingUsers();
      setPendingUsers(data.users);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleApproveUser(id, name) {
    Alert.alert('Approve User', `Approve ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await api.approveUser(id);
            loadPendingUsers();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  async function handleRejectUser(id, name) {
    Alert.alert('Reject User', `Reject and remove ${name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.rejectUser(id);
            loadPendingUsers();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  async function loadPendingRatings() {
    try {
      const data = await api.getPendingRatings();
      setPendingRatings(data.ratings);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleApproveRating(id) {
    try {
      await api.approveRating(id);
      loadPendingRatings();
      loadDashboard();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleRejectRating(id) {
    Alert.alert('Reject Rating', 'Are you sure you want to reject this rating?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.rejectRating(id);
            loadPendingRatings();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  function switchTab(t) {
    setTab(t);
    if (t === 'approvals') loadPendingUsers();
    if (t === 'users') loadUsers();
    if (t === 'listings') loadListings();
    if (t === 'escrows') loadEscrows();
    if (t === 'ratings') loadPendingRatings();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {['dashboard', 'approvals', 'users', 'listings', 'escrows', 'ratings'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => switchTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'dashboard' && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboard} />}
        >
          {dashboard && (
            <>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard label="Total Users" value={dashboard.users.total} />
                <StatCard label="Suspended" value={dashboard.users.suspended} color={colors.error} />
                {Number(dashboard.users.pending_approval) > 0 && (
                  <StatCard label="Pending Approval" value={dashboard.users.pending_approval} color={colors.warning} />
                )}
                <StatCard label="Total Listings" value={dashboard.listings.total} />
                <StatCard label="Active" value={dashboard.listings.active} color={colors.success} />
                <StatCard label="WTS" value={dashboard.listings.wts} color={colors.wts} />
                <StatCard label="WTB" value={dashboard.listings.wtb} color={colors.wtb} />
                <StatCard label="Featured" value={dashboard.featured.total} color={colors.highlight} />
                <StatCard label="Avg Rating" value={dashboard.ratings.avg || '0'} color={colors.star} />
                {Number(dashboard.ratings.pending) > 0 && (
                  <StatCard label="Pending Reviews" value={dashboard.ratings.pending} color={colors.warning} />
                )}
              </View>

              {dashboard.escrows && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Escrow Revenue</Text>
                  <View style={styles.statsGrid}>
                    <StatCard label="Active Escrows" value={dashboard.escrows.active} color={colors.wtb} />
                    <StatCard label="Completed" value={dashboard.escrows.completed} color={colors.success} />
                    <StatCard label="Disputed" value={dashboard.escrows.disputed} color={colors.error} />
                    <StatCard label="Pending Verify" value={dashboard.escrows.pending_verification} color={colors.warning} />
                    <StatCard label="Fees Collected" value={`$${Number(dashboard.escrows.fees_collected).toFixed(0)}`} color={colors.success} />
                    <StatCard label="Total Volume" value={`$${Number(dashboard.escrows.total_volume).toFixed(0)}`} color={colors.primary} />
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {tab === 'approvals' && (
        <FlatList
          data={pendingUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                <Text style={styles.itemTitle}>{item.business_name}</Text>
                <Text style={styles.itemSub}>{item.phone} - {item.city}</Text>
                {item.email && <Text style={styles.itemSub}>{item.email}</Text>}
                <Text style={styles.itemSub}>Referred by: {item.referrer_name || 'Unknown'} ({item.referral_phone})</Text>
                <Text style={styles.itemSub}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </TouchableOpacity>
              <View style={{ gap: spacing.xs }}>
                <Button
                  title="Approve"
                  onPress={() => handleApproveUser(item.id, item.business_name)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32 }}
                  textStyle={{ fontSize: 12 }}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={() => handleRejectUser(item.id, item.business_name)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32 }}
                  textStyle={{ fontSize: 12 }}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pending approvals</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'users' && (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                <Text style={styles.itemTitle}>{item.business_name}</Text>
                <Text style={styles.itemSub}>{item.phone} - {item.city}</Text>
                {item.email && <Text style={styles.itemSub}>{item.email}</Text>}
                {item.is_suspended && <Text style={styles.suspended}>SUSPENDED</Text>}
              </TouchableOpacity>
              <View style={{ gap: spacing.xs }}>
                <Button
                  title={item.is_suspended ? 'Unsuspend' : 'Suspend'}
                  variant={item.is_suspended ? 'outline' : 'danger'}
                  onPress={() => handleSuspend(item.id, item.business_name)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32 }}
                  textStyle={{ fontSize: 12 }}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => handleDeleteUser(item.id, item.business_name)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32, backgroundColor: '#333' }}
                  textStyle={{ fontSize: 12 }}
                />
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'listings' && (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === 'WTS' ? colors.wts : colors.wtb }]}>
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                  {item.is_featured && (
                    <View style={[styles.typeBadge, { backgroundColor: colors.highlight }]}>
                      <Text style={styles.typeBadgeText}>Featured</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSub}>{item.business_name} - {item.city}</Text>
              </View>
              <Button
                title={item.is_featured ? 'Unfeature' : 'Feature'}
                variant={item.is_featured ? 'danger' : 'outline'}
                onPress={() => handleFeature(item.id)}
                style={{ paddingHorizontal: spacing.sm, minHeight: 36 }}
                textStyle={{ fontSize: 12 }}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'escrows' && (
        <FlatList
          data={escrows}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            escrowRevenue && (
              <View style={styles.revenueHeader}>
                <Text style={styles.revenueText}>Fees: ${Number(escrowRevenue.total_fees).toFixed(2)} | Volume: ${Number(escrowRevenue.total_volume).toFixed(2)}</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View style={[styles.typeBadge, { backgroundColor:
                    item.status === 'completed' ? colors.success :
                    item.status === 'disputed' ? colors.error :
                    item.status === 'cancelled' ? colors.textLight :
                    colors.warning
                  }]}>
                    <Text style={styles.typeBadgeText}>{item.status.replace(/_/g, ' ').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.itemTitle}>${Number(item.amount).toLocaleString()} - {item.product_description?.substring(0, 40)}</Text>
                <Text style={styles.itemSub}>{item.buyer_name} → {item.seller_name}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      {tab === 'ratings' && (
        <FlatList
          data={pendingRatings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={styles.ratingStars}>{'★'.repeat(item.stars)}{'☆'.repeat(5 - item.stars)}</Text>
                </View>
                <Text style={styles.itemTitle}>{item.comment}</Text>
                <Text style={styles.itemSub}>
                  From: {item.from_business_name} → To: {item.to_business_name}
                </Text>
                <Text style={styles.itemSub}>
                  Current rating: {Number(item.to_rating_score || 0).toFixed(1)} ({item.to_rating_count || 0} reviews)
                </Text>
              </View>
              <View style={{ gap: spacing.xs }}>
                <Button
                  title="Approve"
                  onPress={() => handleApproveRating(item.id)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32 }}
                  textStyle={{ fontSize: 12 }}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={() => handleRejectRating(item.id)}
                  style={{ paddingHorizontal: spacing.sm, minHeight: 32 }}
                  textStyle={{ fontSize: 12 }}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pending ratings to review</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
  },
  tabBarContent: { paddingHorizontal: spacing.md },
  tab: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    width: '48%',
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  listContent: { paddingBottom: spacing.xl },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 4 },
  itemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  suspended: { fontSize: 11, color: colors.error, fontWeight: '700', marginTop: 2 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  revenueHeader: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  revenueText: { fontSize: 14, fontWeight: '600', color: colors.primary, textAlign: 'center' },
  ratingStars: { fontSize: 16, color: colors.star },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: 15 },
});
