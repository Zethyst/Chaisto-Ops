import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

export type BrandedLogoMarkProps = {
  /** Total width/height of the circular mark including the ring stroke */
  size?: number;
};

/**
 * App logo with a gold ring. Ring is drawn with padding + background (not border) so the
 * image sits flush inside the stroke — avoids RN border/clip halo and flaky Image sizing.
 */
export default function BrandedLogoMark({ size = 96 }: BrandedLogoMarkProps) {
  const stroke = Math.max(2, Math.round((size * 5) / 96));
  const outerRadius = size / 2;
  const innerSize = size - stroke * 2;
  const innerRadius = innerSize / 2;

  return (
    <View
      style={[
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: outerRadius,
          padding: stroke,
        },
      ]}
    >
      <View
        style={[
          styles.innerClip,
          {
            borderRadius: innerRadius,
          },
        ]}
      >
        <Image
          source={require('../assets/app_icon.jpg')}
          style={styles.image}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel="Chaisto"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    backgroundColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  innerClip: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
