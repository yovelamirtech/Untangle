import type * as GoogleMobileAdsNamespace from 'react-native-google-mobile-ads';

type AdsModule = typeof GoogleMobileAdsNamespace;

// A plain `import` of this package touches its native module at module-load
// time (TurboModuleRegistry.getEnforcing), which throws immediately when the
// native module isn't there — as under Expo Go. Loading it via a runtime
// `require` inside a try/catch lets that throw be caught, so the game keeps
// working (just without ads) anywhere the native module isn't linked.
let adsModule: AdsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  adsModule = require('react-native-google-mobile-ads');
} catch {
  adsModule = null;
}

let ready = false;
let interstitial: ReturnType<AdsModule['InterstitialAd']['createForAdRequest']> | null = null;
let interstitialLoaded = false;

function loadNextInterstitial() {
  if (!interstitial) return;
  interstitialLoaded = false;
  interstitial.load();
}

/**
 * Initializes the ads SDK and preloads the first interstitial. Safe to call
 * even where the native module isn't available (e.g. Expo Go) — it just
 * fails quietly and the game continues without ads.
 */
export async function initAds(): Promise<void> {
  if (!adsModule) return;
  try {
    await adsModule.default().initialize();
    // Test ad unit ID — swap for a real one once a real AdMob account exists.
    interstitial = adsModule.InterstitialAd.createForAdRequest(adsModule.TestIds.INTERSTITIAL);
    interstitial.addAdEventListener(adsModule.AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });
    interstitial.addAdEventListener(adsModule.AdEventType.CLOSED, loadNextInterstitial);
    loadNextInterstitial();
    ready = true;
  } catch {
    ready = false;
  }
}

/** Shows the preloaded interstitial if one is ready; a silent no-op otherwise. */
export function showInterstitialIfReady(): void {
  if (!ready || !interstitial || !interstitialLoaded) return;
  interstitial.show();
}
