import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Keyboard, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

const BADGE_CONFIG = {
  founder: { label: 'Verified Owner', bg: '#e8f5e9', text: '#2e7d32', icon: 'shield-checkmark' },
  top_rated: { label: 'Top Rated', bg: '#fff8e1', text: '#f57f17', icon: 'trophy' },
  trusted: { label: 'Trusted Trader', bg: '#e3f2fd', text: '#1565c0', icon: 'ribbon' },
  active: { label: 'Active Seller', bg: '#f3e5f5', text: '#7b1fa2', icon: 'flash' },
  rising: { label: 'Rising Star', bg: '#e0f7fa', text: '#00838f', icon: 'trending-up' },
};

function formatLastSeen(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return 'Online now';
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${Math.floor(days / 7)}w ago`;
}

function Stars({ score, size = 14 }) {
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

export default function UserProfileScreen({ route, navigation }) {
  const id = route.params.userId || route.params.id;
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [references, setReferences] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [tab, setTab] = useState('ratings');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [id]);

  async function loadProfile() {
    try {
      const [userData, refsData, ratingsData] = await Promise.all([
        api.getUser(id),
        api.getReferences(id),
        api.getRatings(id),
      ]);
      setProfile(userData.user);
      setReferences(refsData.references);
      setRatings(ratingsData.ratings);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReport() {
    Alert.prompt('Report User', 'Describe the reason for reporting:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        onPress: async (reason) => {
          if (!reason?.trim()) return;
          try {
            await api.reportUser(id, reason);
            Alert.alert('Reported', 'Thank you. We will review this report.');
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ], 'plain-text');
  }

  function handleBlock() {
    Alert.alert('Block User', `Block ${profile.business_name}? They won't be able to message you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.blockUser(id);
            Alert.alert('Blocked', `${profile.business_name} has been blocked.`);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><Text style={{ color: colors.textSecondary }}>Loading...</Text></View>;
  }

  if (!profile) {
    return <View style={styles.center}><Text style={{ color: colors.textSecondary }}>User not found</Text></View>;
  }

  const isOwnProfile = currentUser?.id === id;
  const lastSeen = formatLastSeen(profile.last_active_at);
  const isOnline = lastSeen === 'Online now';
  const badge = profile.badge && BADGE_CONFIG[profile.badge];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      {/* Navy hero header */}
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.business_name?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <Text style={styles.name}>{profile.business_name}</Text>

        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={13} color={badge.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        )}

        <Text style={styles.info}>{profile.city} · {profile.category}</Text>
        {lastSeen && (
          <View style={styles.lastSeenRow}>
            {isOnline && <View style={styles.lastSeenDot} />}
            <Text style={[styles.lastSeen, !isOnline && { color: 'rgba(255,255,255,0.5)' }]}>{lastSeen}</Text>
          </View>
        )}
      </View>

      {/* Trust stats card (overlaps the hero) */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {profile.rating_score > 0 ? Number(profile.rating_score).toFixed(1) : '—'}
          </Text>
          <Stars score={profile.rating_score || 0} size={11} />
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.rating_count || 0}</Text>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.action} />
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{references.length}</Text>
          <Ionicons name="people-outline" size={14} color={colors.action} />
          <Text style={styles.statLabel}>References</Text>
        </View>
      </View>

      {!isOwnProfile && (
        <View style={styles.actionWrap}>
          <Button
            title="Message"
            onPress={() => navigation.navigate('Chat', { userId: id, name: profile.business_name })}
          />
          <View style={styles.reportRow}>
            <TouchableOpacity onPress={handleReport} style={styles.linkBtn}>
              <Ionicons name="flag-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.reportText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBlock} style={styles.linkBtn}>
              <Ionicons name="ban-outline" size={14} color={colors.error} />
              <Text style={styles.blockText}>Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Segmented control */}
      <View style={styles.segment}>
        <Segment title={`Reviews (${ratings.length})`} active={tab === 'ratings'} onPress={() => setTab('ratings')} />
        <Segment title={`References (${references.length})`} active={tab === 'references'} onPress={() => setTab('references')} />
      </View>

      <View style={styles.listWrap}>
        {tab === 'ratings' && ratings.map(r => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardAvatarWrap}>
                <View style={styles.cardAvatar}>
                  <Text style={styles.cardAvatarText}>{(r.from_business_name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.cardName} numberOfLines={1}>{r.from_business_name}</Text>
              </View>
              <Stars score={r.stars} size={13} />
            </View>
            {r.comment ? <Text style={styles.cardComment}>{r.comment}</Text> : null}
            <Text style={styles.cardDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
          </View>
        ))}

        {tab === 'references' && references.map(ref => (
          <View key={ref.id} style={styles.card}>
            <View style={styles.cardAvatarWrap}>
              <Ionicons name="business-outline" size={18} color={colors.action} style={{ marginRight: spacing.sm }} />
              <Text style={styles.cardName}>{ref.reference_name}</Text>
            </View>
          </View>
        ))}

        {((tab === 'ratings' && ratings.length === 0) || (tab === 'references' && references.length === 0)) && (
          <View style={styles.emptyWrap}>
            <Ionicons
              name={tab === 'ratings' ? 'star-outline' : 'people-outline'}
              size={40}
              color={colors.textLight}
            />
            <Text style={styles.empty}>
              {tab === 'ratings' ? 'No reviews yet' : 'No references yet'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Segment({ title, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatarWrap: { marginBottom: spacing.sm },
  avatarImage: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.action,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 3, borderColor: colors.primary,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  info: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm, textTransform: 'capitalize' },
  lastSeenRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  lastSeenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  lastSeen: { fontSize: 12, color: '#fff', fontWeight: '500' },

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

  actionWrap: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reportText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  blockText: { fontSize: 14, color: colors.error, fontWeight: '500' },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
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

  listWrap: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAvatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  cardAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  cardComment: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  cardDate: { fontSize: 12, color: colors.textLight, marginTop: spacing.sm },

  emptyWrap: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
});
