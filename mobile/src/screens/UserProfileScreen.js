import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Keyboard } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function UserProfileScreen({ route, navigation }) {
  const { id } = route.params;
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

  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  if (!profile) {
    return <View style={styles.center}><Text>User not found</Text></View>;
  }

  const isOwnProfile = currentUser?.id === id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.business_name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.business_name}</Text>
        <Text style={styles.info}>{profile.city} - {profile.category}</Text>
        {profile.rating_score > 0 && (
          <Text style={styles.rating}>
            {'★'.repeat(Math.round(Number(profile.rating_score)))} {Number(profile.rating_score).toFixed(1)} ({profile.rating_count} reviews)
          </Text>
        )}

        {!isOwnProfile && (
          <View style={styles.actions}>
            <Button
              title="Message"
              onPress={() => navigation.navigate('Chat', { userId: id, name: profile.business_name })}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>

      <View style={styles.tabs}>
        <TabBtn title={`Reviews (${ratings.length})`} active={tab === 'ratings'} onPress={() => setTab('ratings')} />
        <TabBtn title={`References (${references.length})`} active={tab === 'references'} onPress={() => setTab('references')} />
      </View>

      {tab === 'ratings' && ratings.map(r => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{r.from_business_name}</Text>
            <Text style={styles.cardStars}>{'★'.repeat(r.stars)}</Text>
          </View>
          {r.comment ? <Text style={styles.cardComment}>{r.comment}</Text> : null}
          <Text style={styles.cardDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
        </View>
      ))}

      {tab === 'references' && references.map(ref => (
        <View key={ref.id} style={styles.card}>
          <Text style={styles.cardName}>{ref.reference_name}</Text>
        </View>
      ))}

      {((tab === 'ratings' && ratings.length === 0) || (tab === 'references' && references.length === 0)) && (
        <Text style={styles.empty}>None yet</Text>
      )}
    </ScrollView>
  );
}

function TabBtn({ title, active, onPress }) {
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  info: { fontSize: 14, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  rating: { fontSize: 15, color: colors.star, marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.md, width: '100%' },
  tabs: { flexDirection: 'row', padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardStars: { fontSize: 14, color: colors.star },
  cardComment: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  cardDate: { fontSize: 12, color: colors.textLight, marginTop: spacing.xs },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.lg },
});
