import { useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, BalanceCard, StatusBadge } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle } from '@/core/rtl';
import { BorderWidth, Colors, Radii, Spacing, Typography } from '@/core/theme';
import { useMarketerWallet } from '@/features/wallet';

export default function WalletScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const directionalText = getDirectionalTextStyle(locale);

  const {
    wallet,
    availableBalanceSyp,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  } = useMarketerWallet();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const hasInitialError = Boolean(errorMessage && !wallet);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.action}
            colors={[Colors.action]}
          />
        }
      >
        <View style={styles.titleRow}>
          <Text style={[Typography.display, directionalText, styles.titleText]}>
            {t.wallet.screenTitle}
          </Text>
          <StatusBadge label={t.profile.roleMarketer} tone="mauve" />
        </View>

        {hasInitialError ? (
          <View style={styles.errorCard} accessibilityLiveRegion="polite">
            <Text style={[Typography.section, directionalText, styles.errorText]}>
              {t.wallet.loadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
              testID="wallet-retry-button"
              variant="primary"
              label={t.common.retry}
              loading={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        ) : (
          <>
            <BalanceCard
              testID="wallet-available-balance-card"
              variant="primary"
              label={t.wallet.availableBalance}
              amountSyp={availableBalanceSyp}
              loading={isLoading && !wallet}
              hint={t.wallet.balanceHint}
            />

            {errorMessage ? (
              <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
                <Text style={[Typography.label, directionalText, styles.errorText]}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoPanel}>
              <Text style={[Typography.body, directionalText, styles.mutedText]}>
                {t.wallet.lastUpdatedLabel}
              </Text>
              <AppButton
                testID="wallet-refresh-button"
                variant="secondary"
                label={t.wallet.refreshAction}
                loading={isRefreshing}
                onPress={handleRefresh}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section,
    gap: Spacing.section,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  titleText: {
    flexShrink: 1,
  },
  errorCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.section,
    gap: Spacing.gutter,
  },
  inlineErrorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.compact + 4,
  },
  errorText: {
    color: Colors.danger,
  },
  infoPanel: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  mutedText: {
    color: Colors.muted,
  },
});
