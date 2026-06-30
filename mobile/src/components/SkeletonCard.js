import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';

// Pulsing placeholder that mirrors ListingCard's layout so first-load
// feels structured and fast instead of a blank spinner.
export default function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Block = ({ style }) => (
    <Animated.View style={[styles.block, style, { opacity: pulse }]} />
  );

  return (
    <View style={styles.card}>
      <Block style={styles.thumb} />
      <Block style={styles.badge} />
      <Block style={styles.titleLine} />
      <Block style={styles.titleLineShort} />
      <Block style={styles.price} />
      <View style={styles.footer}>
        <Block style={styles.avatar} />
        <Block style={styles.seller} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  block: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
  thumb: { width: '100%', height: 170, borderRadius: radius.md, marginBottom: spacing.sm },
  badge: { width: 60, height: 20, borderRadius: radius.pill, marginBottom: spacing.sm },
  titleLine: { width: '85%', height: 14, marginBottom: 6 },
  titleLineShort: { width: '55%', height: 14, marginBottom: spacing.sm },
  price: { width: 90, height: 20, marginBottom: spacing.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  avatar: { width: 24, height: 24, borderRadius: 12, marginRight: spacing.sm },
  seller: { width: 120, height: 12 },
});
