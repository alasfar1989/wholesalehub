import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, Dimensions, StyleSheet, Alert, Linking, Share, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

export default function ListingDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadListing();
    checkFavorite();
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

  async function handleShare() {
    try {
      const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price';
      await Share.share({
        message: `Check out this listing on WholesaleHub!\n\n${listing.title}\nPrice: ${price}\nCondition: ${listing.condition}\nQuantity: ${listing.quantity}\n\nPosted by ${listing.business_name}`,
      });
    } catch {}
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Photos */}
      {listing.photos && listing.photos.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setPhotoIndex(idx);
            }}
          >
            {listing.photos.map((photo, i) => (
              <TouchableOpacity key={photo.id || i} activeOpacity={0.9} onPress={() => { setGalleryIndex(i); setGalleryVisible(true); }}>
                <Image source={{ uri: photo.photo_url }} style={styles.photoFull} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {listing.photos.length > 1 && (
            <View style={styles.photoIndicator}>
              {listing.photos.map((_, i) => (
                <View key={i} style={[styles.photoDot, photoIndex === i && styles.photoDotActive]} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Fullscreen Gallery Modal */}
      <Modal visible={galleryVisible} transparent animationType="fade">
        <View style={styles.galleryOverlay}>
          <TouchableOpacity style={styles.galleryClose} onPress={() => setGalleryVisible(false)}>
            <Text style={styles.galleryCloseText}>Close</Text>
          </TouchableOpacity>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: galleryIndex * Dimensions.get('window').width, y: 0 }}>
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
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: isWTS ? colors.wts : colors.wtb }]}>
            <Text style={styles.badgeText}>{isWTS ? 'For Sale' : 'Want to Buy'}</Text>
          </View>
          {listing.is_featured && (
            <View style={[styles.badge, { backgroundColor: colors.highlight }]}>
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{listing.title}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {listing.price ? `$${Number(listing.price).toLocaleString()}` : 'DM for price'}
          </Text>
          <View style={styles.actionBtns}>
            <TouchableOpacity onPress={toggleFavorite} style={[styles.saveBtn, saved && styles.saveBtnActive]}>
              <Text style={[styles.saveBtnText, saved && styles.saveBtnTextActive]}>{saved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <DetailItem label="Quantity" value={listing.quantity} />
          <DetailItem label="Condition" value={listing.condition} />
          <DetailItem label="Category" value={listing.category} />
          <DetailItem label="City" value={listing.city} />
        </View>

        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Posted By</Text>
          <View style={styles.sellerCard}>
            <Text style={styles.sellerName}>{listing.business_name}</Text>
            <Text style={styles.sellerCity}>{listing.user_city}</Text>
            {listing.rating_score > 0 && (
              <Text style={styles.sellerRating}>
                {'★'.repeat(Math.round(Number(listing.rating_score)))} {Number(listing.rating_score).toFixed(1)} ({listing.rating_count} reviews)
              </Text>
            )}

            <View style={styles.sellerActions}>
              <Button
                title="View Profile"
                variant="outline"
                onPress={() => navigation.navigate('UserProfile', { id: listing.user_id })}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              {!isOwner && (
                <Button
                  title="Message"
                  onPress={() => navigation.navigate('Chat', { userId: listing.user_id, name: listing.business_name })}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </View>
        </View>

        {!isOwner && listing.type === 'WTS' && (
          <Button
            title="Start Escrow"
            onPress={() => navigation.navigate('InitiateEscrow', {
              sellerId: listing.user_id,
              sellerName: listing.business_name,
              amount: listing.price ? String(listing.price) : '',
              description: `${listing.title} - Qty: ${listing.quantity}`,
              listingId: listing.id,
            })}
            style={{ marginBottom: spacing.sm }}
          />
        )}

        {!isOwner && listing.user_phone && (
          <Button
            title={`Call ${listing.user_phone}`}
            variant="outline"
            onPress={handleContact}
            style={{ marginBottom: spacing.md }}
          />
        )}

        {isOwner && listing.is_active === false && (
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
            style={{ marginBottom: spacing.sm, backgroundColor: colors.primary }}
          />
        )}

        {isOwner && (
          <>
            {listing.is_active !== false && !listing.is_featured && (
              <Button
                title="Feature This Listing - $2.99/day"
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
                title="Edit Listing"
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
          </>
        )}

        <Text style={styles.date}>
          Posted {new Date(listing.created_at).toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
}

function DetailItem({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  photoScroll: {
    height: 260,
    backgroundColor: colors.surface,
  },
  photoFull: {
    width: Dimensions.get('window').width,
    height: 260,
  },
  photoIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  photoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },
  photoDotActive: {
    backgroundColor: colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
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
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sellerCity: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sellerRating: {
    fontSize: 14,
    color: colors.star,
    marginTop: spacing.xs,
  },
  sellerActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  ownerActions: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnActive: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtnTextActive: {
    color: '#fff',
  },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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
  galleryCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  galleryImage: {
    width: Dimensions.get('window').width,
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
  },
});
