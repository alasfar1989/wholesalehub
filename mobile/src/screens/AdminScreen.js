import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

function statusBadgeColors(status) {
  switch (status) {
    case 'completed': return { bg: colors.successSoft, text: colors.success };
    case 'disputed': return { bg: colors.errorSoft, text: colors.error };
    case 'cancelled': return { bg: colors.surfaceAlt, text: colors.textSecondary };
    default: return { bg: colors.warningSoft, text: colors.warning };
  }
}

function SoftBadge({ label, bg, text }) {
  return (
    <View style={[styles.softBadge, { backgroundColor: bg }]}>
      <Text style={[styles.softBadgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

function Empty({ icon, title, text }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={34} color={colors.textLight} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [escrowRevenue, setEscrowRevenue] = useState(null);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  function openReviewModal(user) {
    setReviewTarget(user);
    setReviewStars(5);
    setReviewComment('');
  }

  function closeReviewModal() {
    setReviewTarget(null);
    setReviewStars(5);
    setReviewComment('');
  }

  async function submitAdminReview() {
    if (!reviewComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.adminRateUser({
        to_user_id: reviewTarget.id,
        stars: reviewStars,
        comment: reviewComment.trim(),
      });
      closeReviewModal();
      loadDashboard();
      Alert.alert('Success', 'Review posted');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setReviewSubmitting(false);
    }
  }

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

  async function handleDeleteListing(listingId, title) {
    Alert.alert('Delete Listing', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminDeleteListing(listingId);
            loadListings();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
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

  async function loadReports() {
    try {
      const data = await api.getAdminReports();
      setReports(data.reports);
    } catch (err) {
      console.error(err);
    }
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
    if (t === 'reports') loadReports();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {['dashboard', 'approvals', 'users', 'listings', 'escrows', 'ratings', 'reports'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => switchTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {tab === 'dashboard' && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboard} tintColor={colors.primary} />}
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
              <TouchableOpacity style={styles.itemMain} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                <View style={styles.badgeRow}>
                  <SoftBadge label="Pending" bg={colors.warningSoft} text={colors.warning} />
                </View>
                <Text style={styles.itemTitle}>{item.business_name}</Text>
                <Text style={styles.itemSub}>{item.phone} · {item.city}</Text>
                {item.email && <Text style={styles.itemSub}>{item.email}</Text>}
                <Text style={styles.itemSub}>Referred by: {item.referrer_name || 'Unknown'} ({item.referral_phone})</Text>
                <Text style={styles.itemMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </TouchableOpacity>
              <View style={styles.actionCol}>
                <Button
                  title="Approve"
                  onPress={() => handleApproveUser(item.id, item.business_name)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={() => handleRejectUser(item.id, item.business_name)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Empty icon="checkmark-done-outline" title="No pending approvals" text="New signups will appear here" />
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
              <TouchableOpacity style={styles.itemMain} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                {item.is_suspended ? (
                  <View style={styles.badgeRow}>
                    <SoftBadge label="Suspended" bg={colors.errorSoft} text={colors.error} />
                  </View>
                ) : (
                  <View style={styles.badgeRow}>
                    <SoftBadge label="Active" bg={colors.successSoft} text={colors.success} />
                  </View>
                )}
                <Text style={styles.itemTitle}>{item.business_name}</Text>
                <Text style={styles.itemSub}>{item.phone} · {item.city}</Text>
                {item.email && <Text style={styles.itemSub}>{item.email}</Text>}
              </TouchableOpacity>
              <View style={styles.actionCol}>
                <Button
                  title={item.is_suspended ? 'Unsuspend' : 'Suspend'}
                  variant={item.is_suspended ? 'outline' : 'danger'}
                  onPress={() => handleSuspend(item.id, item.business_name)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
                <Button
                  title="Review"
                  variant="outline"
                  onPress={() => openReviewModal(item)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => handleDeleteUser(item.id, item.business_name)}
                  style={[styles.smallBtn, { backgroundColor: colors.text }]}
                  textStyle={styles.smallBtnText}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Empty icon="people-outline" title="No users" />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'listings' && (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.itemMain}>
                <View style={styles.badgeRow}>
                  <SoftBadge
                    label={item.type}
                    bg={item.type === 'WTS' ? colors.wtsSoft : colors.wtbSoft}
                    text={item.type === 'WTS' ? colors.wtsText : colors.wtbText}
                  />
                  {item.is_featured && (
                    <SoftBadge label="Featured" bg={colors.highlightSoft} text={colors.highlight} />
                  )}
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSub}>{item.business_name} · {item.city}</Text>
              </View>
              <View style={styles.actionCol}>
                <Button
                  title={item.is_featured ? 'Unfeature' : 'Feature'}
                  variant={item.is_featured ? 'danger' : 'outline'}
                  onPress={() => handleFeature(item.id)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => handleDeleteListing(item.id, item.title)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Empty icon="pricetags-outline" title="No listings" />
          }
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
                <Text style={styles.revenueText}>Fees: ${Number(escrowRevenue.total_fees).toFixed(2)}  ·  Volume: ${Number(escrowRevenue.total_volume).toFixed(2)}</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const sc = statusBadgeColors(item.status);
            return (
              <TouchableOpacity
                style={styles.listItem}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
              >
                <View style={styles.itemMain}>
                  <View style={styles.badgeRow}>
                    <SoftBadge label={item.status.replace(/_/g, ' ').toUpperCase()} bg={sc.bg} text={sc.text} />
                  </View>
                  <Text style={styles.itemTitle}>${Number(item.amount).toLocaleString()} · {item.product_description?.substring(0, 40)}</Text>
                  <Text style={styles.itemSub}>{item.buyer_name} → {item.seller_name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Empty icon="shield-checkmark-outline" title="No escrows" />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
      {tab === 'reports' && (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('UserProfile', { userId: item.reported_user_id })}
            >
              <View style={styles.itemMain}>
                <View style={styles.badgeRow}>
                  <SoftBadge label="Report" bg={colors.errorSoft} text={colors.error} />
                </View>
                <Text style={styles.itemTitle}>Reporter: {item.reporter_name}</Text>
                <Text style={styles.itemSub}>Reported: {item.reported_name}</Text>
                <Text style={styles.itemSub}>Reason: {item.reason}</Text>
                <Text style={styles.itemMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Empty icon="flag-outline" title="No reports" text="User reports will appear here" />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'ratings' && (
        <FlatList
          data={pendingRatings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.itemMain}>
                <Text style={styles.ratingStars}>{'★'.repeat(item.stars)}{'☆'.repeat(5 - item.stars)}</Text>
                <Text style={styles.itemTitle}>{item.comment}</Text>
                <Text style={styles.itemSub}>
                  From: {item.from_business_name} → To: {item.to_business_name}
                </Text>
                <Text style={styles.itemMeta}>
                  Current rating: {Number(item.to_rating_score || 0).toFixed(1)} ({item.to_rating_count || 0} reviews)
                </Text>
              </View>
              <View style={styles.actionCol}>
                <Button
                  title="Approve"
                  onPress={() => handleApproveRating(item.id)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={() => handleRejectRating(item.id)}
                  style={styles.smallBtn}
                  textStyle={styles.smallBtnText}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Empty icon="star-outline" title="No pending ratings" text="Reviews awaiting approval will appear here" />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
      <Modal
        visible={!!reviewTarget}
        transparent
        animationType="fade"
        onRequestClose={closeReviewModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review {reviewTarget?.business_name}</Text>
            <Text style={styles.modalLabel}>Rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setReviewStars(n)}>
                  <Text style={styles.starPick}>{n <= reviewStars ? '★' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Comment</Text>
            <TextInput
              style={styles.modalInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Write your review..."
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={4}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={closeReviewModal}
                style={{ flex: 1 }}
              />
              <Button
                title={reviewSubmitting ? 'Posting...' : 'Post Review'}
                onPress={submitAdminReview}
                disabled={reviewSubmitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  },
  tabBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: {
    backgroundColor: colors.action,
  },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  content: { padding: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: '48%',
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },

  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  itemMain: { flex: 1, marginRight: spacing.sm },
  actionCol: { gap: spacing.xs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2, letterSpacing: -0.2 },
  itemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  itemMeta: { fontSize: 12, color: colors.textLight, marginTop: 4 },

  smallBtn: { paddingHorizontal: spacing.sm, minHeight: 34 },
  smallBtnText: { fontSize: 12 },

  softBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  softBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

  revenueHeader: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  revenueText: { fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  ratingStars: { fontSize: 16, color: colors.star },

  emptyContainer: { alignItems: 'center', marginTop: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2, marginBottom: spacing.xs },
  emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.3 },
  modalLabel: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs, fontWeight: '500' },
  starRow: { flexDirection: 'row', gap: spacing.sm },
  starPick: { fontSize: 32, color: colors.star },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
