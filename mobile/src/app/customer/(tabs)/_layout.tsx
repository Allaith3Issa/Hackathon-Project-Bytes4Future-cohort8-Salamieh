import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/core/i18n';
import { BorderWidth, Colors, FontFamily, Spacing, TouchTarget } from '@/core/theme';

function OffersTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.offerTicketOuter,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.offerTicketDot, { borderColor: color }]} />
        <View style={[styles.offerTicketLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function CashbackTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.cashbackCoinOuter,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.cashbackCoinInner, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function PurchasesTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.iconFrame} accessible={false}>
      <View
        style={[
          styles.purchasesBagOuter,
          {
            borderColor: color,
            backgroundColor: focused ? Colors.mauveTint : 'transparent',
          },
        ]}
      >
        <View style={[styles.purchasesLine, { backgroundColor: color }]} />
        <View style={[styles.purchasesLineShort, { backgroundColor: color }]} />
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

function renderOffersTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <OffersTabIcon color={color} focused={focused} />;
}

function renderCashbackTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <CashbackTabIcon color={color} focused={focused} />;
}

function renderPurchasesTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <PurchasesTabIcon color={color} focused={focused} />;
}

function renderProfileTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <ProfileTabIcon color={color} focused={focused} />;
}

export default function CustomerTabsLayout() {
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

  const offersOptions = useMemo(
    () => ({
      title: t.customerTabs.offers,
      tabBarAccessibilityLabel: t.customerTabs.offers,
      tabBarIcon: renderOffersTabIcon,
    }),
    [t.customerTabs.offers],
  );

  const cashbackOptions = useMemo(
    () => ({
      title: t.customerTabs.cashback,
      tabBarAccessibilityLabel: t.customerTabs.cashback,
      tabBarIcon: renderCashbackTabIcon,
    }),
    [t.customerTabs.cashback],
  );

  const purchasesOptions = useMemo(
    () => ({
      title: t.customerTabs.purchases,
      tabBarAccessibilityLabel: t.customerTabs.purchases,
      tabBarIcon: renderPurchasesTabIcon,
    }),
    [t.customerTabs.purchases],
  );

  const profileOptions = useMemo(
    () => ({
      title: t.customerTabs.profile,
      tabBarAccessibilityLabel: t.customerTabs.profile,
      tabBarIcon: renderProfileTabIcon,
    }),
    [t.customerTabs.profile],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={offersOptions} />
      <Tabs.Screen name="cashback" options={cashbackOptions} />
      <Tabs.Screen name="purchases" options={purchasesOptions} />
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
  offerTicketOuter: {
    width: 21,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  offerTicketDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  offerTicketLine: {
    width: 7,
    height: 2,
    borderRadius: 1,
  },
  cashbackCoinOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashbackCoinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  purchasesBagOuter: {
    width: 19,
    height: 19,
    borderRadius: 4,
    borderWidth: 1.8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    gap: 3,
  },
  purchasesLine: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  purchasesLineShort: {
    height: 2,
    width: '65%',
    borderRadius: 1,
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
