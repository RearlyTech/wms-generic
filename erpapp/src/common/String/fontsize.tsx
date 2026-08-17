import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Base screen width (used as a reference, e.g., iPhone 11)
const BASE_WIDTH = 360;

/**
 * Normalizes font size across different devices
 * @param {number} size - Original font size
 * @returns {number} - Normalized font size
 */
export const normalize = (size: number) => {
  let scaleFactor = SCREEN_WIDTH / BASE_WIDTH;

  // Adjust scale for high-density screens
  if (PixelRatio.get() >= 2 && PixelRatio.get() < 3) {
    scaleFactor *= 0.8;
  } else if (PixelRatio.get() >= 3) {
    scaleFactor *= 0.75;
  }

  // Ensure a minimum size to prevent text from becoming too small
  const normalizedSize = Math.max(size * scaleFactor, size * 0.8);

  // Platform-specific rounding
  return Platform.OS === 'ios'
    ? Math.round(PixelRatio.roundToNearestPixel(normalizedSize))
    : Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

