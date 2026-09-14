import { StyleSheet, View } from 'react-native';

import { adsModule } from './ads';

/** Renders a banner ad, or nothing where the ads native module isn't available (e.g. Expo Go). */
export default function AdBanner() {
  if (!adsModule) return null;
  const { BannerAd, BannerAdSize, TestIds } = adsModule;

  return (
    <View style={styles.container}>
      <BannerAd unitId={TestIds.BANNER} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1B1530',
  },
});
