import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Dimensions, StyleSheet, Alert, Linking, Share, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing, radius, shadows } from '../utils/theme';

const SCREEN_W = Dimensions.get('window').width;

function Stars({ score }) {
  const rounded = Math.round(Number(score));
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons
          key={n}
          name={n <= rounded ? 'star' : 'star-outline'}
          size={14}
          color={colors.star}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

export default function ListingDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadListing();
    checkFavorite();
    api.trackListingView(id).catch(() => {});
  }, [id]);

  async function checkFavorite() {
    try {
      const data = await api.getFavorites();
      setSaved(data.listings.some(l => l.id === id));
    } catch {}
  }

  async function toggleFavorite() {
    try {
      if (saved) {
        await api.unfavoriteListing(id);
        setSaved(false);
      } else {
        await api.favoriteListing(id);
        setSaved(true);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  async function loadListing() {
    try {
      const data = await api.getListing(id);
      setListing(data.listing);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete Listing', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteListing(id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  function handleContact() {
    if (listing.user_phone) {
      Linking.openURL(`tel:${listing.user_phone}`);
    }
  }

  function shareMessage() {
    const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price';
    const base = Constants.expoConfig?.extra?.apiUrl || 'https://wholesalehub-production-25ae.up.railway.app';
    const link = `${base}/listing/${listing.id}`;
    return `Check out this listing on WholesaleHub!\n\n${listing.title}\nPrice: ${price}\nCondition: ${listing.condition}\nQuantity: ${listing.quantity}\n\nPosted by ${listing.business_name}\n\nView it here: ${link}`;
  }

  async function handleShare() {
    try {
      await Share.share({ message: shareMessage() });
    } catch {}
  }

  async function handleWhatsApp() {
    const text = encodeURIComponent(shareMessage());
    const appUrl = `whatsapp://send?text=${text}`;
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : `https://wa.me/?text=${text}`);
    } catch {
      Alert.alert('WhatsApp unavailable', 'Could not open WhatsApp on this device.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Ionicons name="document-outline" size={48} color={colors.textLight} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Listing not found</Text>
      </View>
    );
  }

  const isOwner = user && user.id === listing.user_id;
  const isWTS = listing.type === 'WTS';
  const hasPhotos = listing.photos && listing.photos.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: isOwner ? spacing.xl : 120 }]}>
        {/* Photos / hero */}
        <View style={styles.hero}>
          {hasPhotos ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.photoScroll}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setPhotoIndex(idx);
              }}
            >
              {listing.photos.map((photo, i) => (
                <TouchableOpacity key={photo.id || i} activeOpacity={0.95} onPress={() => { setGalleryIndex(i); setGalleryVisible(true); }}>
                  <Image source={{ uri: photo.photo_url }} style={styles.photoFull} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photoFull, styles.photoPlaceholder]}>
              <Ionicons name="image-outline" size={48} color={colors.textLight} />
            </View>
          )}

          {/* Floating type / featured badges */}
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: isWTS ? colors.wtsSoft : colors.wtbSoft }]}>
              <View style={[styles.badgeDot, { backgroundColor: isWTS ? colors.wtsText : colors.wtbText }]} />
              <Text style={[styles.badgeText, { color: isWTS ? colors.wtsText : colors.wtbText }]}>{listing.type}</Text>
            </View>
            {listing.is_featured && (
              <View style={[styles.badge, styles.featuredBadge]}>
                <Text style={styles.featuredText}>★ Featured</Text>
              </View>
            )}
          </View>

          {/* Floating share / whatsapp / save */}
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.circleBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleBtn, styles.whatsappCircle]} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={toggleFavorite}>
              <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.error : colors.text} />
            </TouchableOpacity>
          </View>

          {/* Photo counter */}
          {hasPhotos && listing.photos.length > 1 && (
            <View style={styles.counterPill}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={styles.counterText}>{photoIndex + 1}/{listing.photos.length}</Text>
            </View>
          )}
        </View>

        {/* Fullscreen Gallery Modal */}
        <Modal visible={galleryVisible} transparent animationType="fade">
          <View style={styles.galleryOverlay}>
            <TouchableOpacity style={styles.galleryClose} onPress={() => setGalleryVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: galleryIndex * SCREEN_W, y: 0 }}>
              {(listing.photos || []).map((photo, i) => (
                <Image key={photo.id || i} source={{ uri: photo.photo_url }} style={styles.galleryImage} resizeMode="contain" />
              ))}
            </ScrollView>
            <Text style={styles.galleryCounter}>
              {listing.photos ? `${galleryIndex + 1} / ${listing.photos.length}` : ''}
            </Text>
          </View>
        </Modal>

        <View style={styles.innerContent}>
          <Text style={styles.title}>{listing.title}</Text>

          <Text style={styles.price}>
            {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
          </Text>

          {/* Dot indicators (kept for at-a-glance) */}
          {hasPhotos && listing.photos.length > 1 && (
            <View style={styles.photoIndicator}>
              {listing.photos.map((_, i) => (
                <View key={i} style={[styles.photoDot, photoIndex === i && styles.photoDotActive]} />
              ))}
            </View>
          )}

          <View style={styles.detailsGrid}>
            <DetailItem
              icon="cube-outline"
              label="Quantity"
              value={
                listing.quantity > 1 && listing.quantity_sold > 0
                  ? `${listing.quantity - listing.quantity_sold} of ${listing.quantity} left`
                  : String(listing.quantity)
              }
            />
            <DetailItem icon="pricetag-outline" label="Condition" value={listing.condition} />
            <DetailItem icon="grid-outline" label="Category" value={listing.category} />
            <DetailItem icon="location-outline" label="City" value={listing.city} />
          </View>

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {/* Seller trust block */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <TouchableOpacity
              style={styles.sellerCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('UserProfile', { id: listing.user_id })}
            >
              {listing.user_avatar ? (
                <Image source={{ uri: listing.user_avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarFallback}>
                  <Text style={styles.sellerAvatarText}>
                    {(listing.business_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName} numberOfLines={1}>{listing.business_name}</Text>
                {listing.user_city ? <Text style={styles.sellerCity}>{listing.user_city}</Text> : null}
                {listing.rating_score > 0 ? (
                  <View style={styles.sellerRatingRow}>
                    <Stars score={listing.rating_score} />
                    <Text style={styles.sellerRatingText}>
                      {Number(listing.rating_score).toFixed(1)} ({listing.rating_count})
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.sellerNoRating}>No reviews yet</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>

            {!isOwner && listing.user_phone && (
              <Button
                title={`Call ${listing.user_phone}`}
                variant="outline"
                onPress={handleContact}
                style={{ marginTop: spacing.sm }}
              />
            )}
          </View>

          {/* Make an offer (buyers, WTS only) */}
          {!isOwner && listing.type === 'WTS' && (
            <Button
              title="Make an Offer"
              variant="outline"
              onPress={() => navigation.navigate('MakeOffer', { listing })}
              style={{ marginBottom: spacing.md }}
            />
          )}

          {/* Owner controls */}
          {isOwner && (
            <View style={styles.section}>
              {listing.is_active === false && (
                <Button
                  title="Renew Listing"
                  onPress={async () => {
                    try {
                      await api.renewListing(listing.id);
                      Alert.alert('Success', 'Listing renewed successfully');
                      loadListing();
                    } catch (err) {
                      Alert.alert('Error', err.message);
                    }
                  }}
                  style={{ marginBottom: spacing.sm }}
                />
              )}
              {listing.is_active !== false && !listing.is_featured && (
                <Button
                  title="Feature This Listing — $2.99/day"
                  onPress={() => {
                    Alert.alert(
                      'Feature Listing',
                      'Your listing will appear at the top of the feed for 24 hours.\n\nCost: $2.99\nLimit: 3 per type, 1 per user per day',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Feature It',
                          onPress: async () => {
                            try {
                              const result = await api.featureListing(listing.id);
                              Alert.alert('Featured!', result.message);
                              loadListing();
                            } catch (err) {
                              Alert.alert('Error', err.message);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={{ marginBottom: spacing.sm, backgroundColor: colors.highlight }}
                />
              )}
              {listing.is_active !== false && (
                <Button
                  title="Mark as Sold"
                  onPress={() => navigation.navigate('MarkSold', { listing })}
                  style={{ marginBottom: spacing.sm, backgroundColor: colors.success }}
                />
              )}
              <View style={styles.ownerActions}>
                <Button
                  title="Edit"
                  variant="outline"
                  onPress={() => navigation.navigate('CreateListing', { listing })}
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={handleDelete}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}

          <Text style={styles.date}>
            Posted {new Date(listing.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky buyer action bar */}
      {!isOwner && (
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TouchableOpacity style={styles.saveSquare} onPress={toggleFavorite}>
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={24} color={saved ? colors.error : colors.text} />
          </TouchableOpacity>
          <Button
            title="Message"
            variant={isWTS ? 'outline' : 'primary'}
            onPress={() => navigation.navigate('Chat', { userId: listing.user_id, name: listing.business_name })}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
          {isWTS && (
            <Button
              title="Start Escrow"
              onPress={() => navigation.navigate('InitiateEscrow', {
                sellerId: listing.user_id,
                sellerName: listing.business_name,
                amount: listing.price ? String(listing.price) : '',
                description: `${listing.title} - Qty: ${listing.quantity}`,
                listingId: listing.id,
              })}
              style={{ flex: 1, marginLeft: spacing.sm }}
            />
          )}
        </View>
      )}
    </View>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color={colors.action} style={{ marginBottom: 4 }} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  hero: {
    position: 'relative',
  },
  photoScroll: {
    height: 280,
    backgroundColor: colors.surface,
  },
  photoFull: {
    width: SCREEN_W,
    height: 280,
  },
  photoPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroActions: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  whatsappCircle: {
    backgroundColor: '#25D366',
  },
  counterPill: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  photoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
    marginHorizontal: 3,
  },
  photoDotActive: {
    backgroundColor: colors.action,
    width: 18,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
  },
  innerContent: {
    padding: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  featuredBadge: {
    backgroundColor: colors.highlight,
  },
  featuredText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
    lineHeight: 30,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  detailItem: {
    width: '50%',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
  },
  sellerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sellerCity: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sellerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  sellerRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sellerNoRating: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
  },
  ownerActions: {
    flexDirection: 'row',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  galleryClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  galleryImage: {
    width: SCREEN_W,
    height: Dimensions.get('window').height * 0.7,
  },
  galleryCounter: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
  },
  date: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  saveSquare: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
