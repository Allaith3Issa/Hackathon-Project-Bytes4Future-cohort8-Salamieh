import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/core/i18n';
import { BorderWidth, Colors, FontFamily, Spacing, TouchTarget } from '@/core/theme';

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

function renderCampaignsTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <CampaignsTabIcon color={color} focused={focused} />;
}

function renderWalletTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <WalletTabIcon color={color} focused={focused} />;
}

function renderProfileTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <ProfileTabIcon color={color} focused={focused} />;
}

export default function MarketerTabsLayout() {
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
        fontSize: 12,
        lineHeight: 16,
      },
    }),
    [bottomPadding, layoutDirection],
  );

  const campaignsOptions = useMemo(
    () => ({
      title: t.tabs.campaigns,
      tabBarAccessibilityLabel: t.tabs.campaigns,
      tabBarIcon: renderCampaignsTabIcon,
    }),
    [t.tabs.campaigns],
  );

  const walletOptions = useMemo(
    () => ({
      title: t.tabs.wallet,
      tabBarAccessibilityLabel: t.tabs.wallet,
      tabBarIcon: renderWalletTabIcon,
    }),
    [t.tabs.wallet],
  );

  const profileOptions = useMemo(
    () => ({
      title: t.tabs.profile,
      tabBarAccessibilityLabel: t.tabs.profile,
      tabBarIcon: renderProfileTabIcon,
    }),
    [t.tabs.profile],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={campaignsOptions} />
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
