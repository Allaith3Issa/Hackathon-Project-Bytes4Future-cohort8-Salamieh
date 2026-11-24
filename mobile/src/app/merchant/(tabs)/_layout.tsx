import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/core/i18n';
import { BorderWidth, Colors, FontFamily, Spacing, TouchTarget } from '@/core/theme';

function DashboardTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const cellFill = focused ? Colors.mauveTint : 'transparent';
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View style={styles.gridRow}>
        <View style={[styles.gridCell, { borderColor: color, backgroundColor: cellFill }]} />
        <View style={[styles.gridCell, { borderColor: color, backgroundColor: cellFill }]} />
      </View>
      <View style={styles.gridRow}>
        <View style={[styles.gridCell, { borderColor: color, backgroundColor: cellFill }]} />
        <View style={[styles.gridCell, { borderColor: color, backgroundColor: cellFill }]} />
      </View>
    </View>
  );
}

function CampaignsTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.campaignsTagOuter,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.campaignsTagLine, { backgroundColor: color }]} />
        <View style={[styles.campaignsTagLineShort, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ScannerTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.scannerFrame,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.scannerLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function WalletTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.walletBody,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.walletClasp, { borderColor: color }]} />
      </View>
    </View>
  );
}

function ProfileTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.profileHead,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      />
      <View
        style={[
          styles.profileShoulders,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      />
    </View>
  );
}

function renderDashboardTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <DashboardTabIcon color={color} focused={focused} />;
}

function renderCampaignsTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <CampaignsTabIcon color={color} focused={focused} />;
}

function renderScannerTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <ScannerTabIcon color={color} focused={focused} />;
}

function renderWalletTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <WalletTabIcon color={color} focused={focused} />;
}

function renderProfileTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <ProfileTabIcon color={color} focused={focused} />;
}

export default function MerchantTabsLayout() {
  const { isRtl, t } = useLocale();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Spacing.compact);
  const layoutDirection: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: {
        backgroundColor: Colors.canvas,
        direction: layoutDirection,
      },
      tabBarActiveTintColor: Colors.action,
      tabBarInactiveTintColor: Colors.muted,
      tabBarStyle: {
        direction: layoutDirection,
        backgroundColor: Colors.surface,
        borderTopColor: Colors.rule,
        borderTopWidth: BorderWidth.hairline,
        minHeight: 60 + bottomPadding,
        paddingTop: Spacing.xs + 2,
        paddingBottom: bottomPadding,
      },
      tabBarItemStyle: {
        minHeight: TouchTarget.minHeight,
        minWidth: TouchTarget.minWidth,
      },
      tabBarLabelStyle: {
        fontFamily: FontFamily.semiBold,
        fontSize: 11,
        lineHeight: 15,
      },
    }),
    [bottomPadding, layoutDirection],
  );

  const dashboardOptions = useMemo(
    () => ({
      title: t.merchant.tabs.dashboard,
      tabBarAccessibilityLabel: t.merchant.tabs.dashboard,
      tabBarIcon: renderDashboardTabIcon,
    }),
    [t.merchant.tabs.dashboard],
  );

  const campaignsOptions = useMemo(
    () => ({
      title: t.merchant.tabs.campaigns,
      tabBarAccessibilityLabel: t.merchant.tabs.campaigns,
      tabBarIcon: renderCampaignsTabIcon,
    }),
    [t.merchant.tabs.campaigns],
  );

  const scannerOptions = useMemo(
    () => ({
      title: t.merchant.tabs.scanner,
      tabBarAccessibilityLabel: t.merchant.tabs.scanner,
      tabBarIcon: renderScannerTabIcon,
    }),
    [t.merchant.tabs.scanner],
  );

  const walletOptions = useMemo(
    () => ({
      title: t.merchant.tabs.wallet,
      tabBarAccessibilityLabel: t.merchant.tabs.wallet,
      tabBarIcon: renderWalletTabIcon,
    }),
    [t.merchant.tabs.wallet],
  );

  const profileOptions = useMemo(
    () => ({
      title: t.merchant.tabs.profile,
      tabBarAccessibilityLabel: t.merchant.tabs.profile,
      tabBarIcon: renderProfileTabIcon,
    }),
    [t.merchant.tabs.profile],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={dashboardOptions} />
      <Tabs.Screen name="campaigns" options={campaignsOptions} />
      <Tabs.Screen name="scanner" options={scannerOptions} />
      <Tabs.Screen name="wallet" options={walletOptions} />
      <Tabs.Screen name="profile" options={profileOptions} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 2,
  },
  gridCell: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: 1.7,
  },
  campaignsTagOuter: {
    width: 20,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    gap: 3,
  },
  campaignsTagLine: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  campaignsTagLineShort: {
    height: 2,
    width: '65%',
    borderRadius: 1,
  },
  scannerFrame: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  scannerLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  walletBody: {
    width: 21,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.8,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingEnd: 2,
  },
  walletClasp: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.8,
    marginBottom: 2,
  },
  profileShoulders: {
    width: 16,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.8,
  },
});
