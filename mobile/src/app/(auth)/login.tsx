import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppInput, BrandMark, StatusBadge } from '@/components/ui';
import { env } from '@/core/config';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useLoginForm } from '@/features/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const reducedMotion = useReducedMotion();
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    phone,
    password,
    setPhone,
    setPassword,
    fieldErrors,
    formError,
    isSubmitting,
    isSandboxSubmitting,
    isCustomerSandboxSubmitting,
    isMerchantSandboxSubmitting,
    isAnySubmitting,
    sessionExpiredNotice,
    submit,
    submitDevSandbox,
    submitDevCustomerSandbox,
    submitDevMerchantSandbox,
  } = useLoginForm();

  useAndroidBack({
    isBusy: isAnySubmitting,
    isRootTab: true,
  });

  const handleTogglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible((prev) => !prev);
  }, []);

  const handlePhoneSubmitEditing = useCallback(() => {
    passwordInputRef.current?.focus();
  }, []);

  const handleLoginPress = useCallback(() => {
    void submit();
  }, [submit]);

  const handleDevSandboxPress = useCallback(() => {
    void submitDevSandbox();
  }, [submitDevSandbox]);

  const handleDevCustomerSandboxPress = useCallback(() => {
    void submitDevCustomerSandbox();
  }, [submitDevCustomerSandbox]);

  const handleDevMerchantSandboxPress = useCallback(() => {
    void submitDevMerchantSandbox();
  }, [submitDevMerchantSandbox]);

  const handleOpenRegister = useCallback(() => {
    if (isAnySubmitting) {
      return;
    }
    router.push('/(auth)/register' as Href);
  }, [isAnySubmitting, router]);

  const directionalText = getDirectionalTextStyle(locale);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(240)}
            style={styles.brandHeader}
          >
            <View style={styles.brandMarkRow}>
              <BrandMark testID="login-brand-mark" size="lg" decorative />
              <View style={styles.brandMeta}>
                <Text style={[Typography.section, directionalText, styles.brandName]}>
                  {t.common.appName}
                </Text>
                <View style={styles.badgesRow}>
                  <StatusBadge label={t.profile.roleCustomer} tone="success" showDot />
                  <StatusBadge label={t.profile.roleMarketer} tone="mauve" showDot />
                  <StatusBadge label={t.profile.roleMerchant} tone="info" showDot />
                  {__DEV__ && env.useDevSandbox ? (
                    <StatusBadge label={t.auth.devSandboxBadge} tone="info" />
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>

          {sessionExpiredNotice ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.noticeBanner}
            >
              <Text style={[Typography.label, directionalText, styles.noticeText]}>
                {t.auth.sessionExpired}
              </Text>
            </View>
          ) : null}

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(260)}
            style={styles.formCard}
          >
            <View style={styles.headingBlock}>
              <Text style={[Typography.display, directionalText]}>{t.auth.title}</Text>
              <Text style={[Typography.body, directionalText, styles.subtitle]}>
                {t.auth.subtitle}
              </Text>
            </View>

            <View style={styles.fieldsStack}>
              <AppInput
                testID="login-phone-input"
                label={t.auth.phoneLabel}
                placeholder={t.auth.phonePlaceholder}
                value={phone}
                onChangeText={setPhone}
                forceLtr
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="telephoneNumber"
                returnKeyType="next"
                editable={!isAnySubmitting}
                onSubmitEditing={handlePhoneSubmitEditing}
                error={fieldErrors.phone}
              />

              <AppInput
                ref={passwordInputRef}
                testID="login-password-input"
                label={t.auth.passwordLabel}
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                editable={!isAnySubmitting}
                onSubmitEditing={handleLoginPress}
                error={fieldErrors.password}
                endAccessory={
                  <Pressable
                    onPress={handleTogglePasswordVisibility}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword
                    }
                    style={styles.toggleVisibilityButton}
                  >
                    <Text style={[Typography.label, styles.toggleVisibilityText]}>
                      {isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword}
                    </Text>
                  </Pressable>
                }
              />
            </View>

            {formError ? (
              <View accessibilityLiveRegion="polite" style={styles.formErrorBox}>
                <Text style={[Typography.label, directionalText, styles.formErrorText]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsStack}>
              <AppButton
                testID="login-submit-button"
                variant="primary"
                label={t.auth.submit}
                loadingLabel={t.auth.submitting}
                loading={isSubmitting}
                disabled={isAnySubmitting}
                haptic="medium"
                onPress={handleLoginPress}
              />

              <AppButton
                testID="login-create-account-link"
                variant="ghost"
                label={t.auth.createAccountLink}
                disabled={isAnySubmitting}
                haptic="light"
                onPress={handleOpenRegister}
              />

              {__DEV__ && env.useDevSandbox ? (
                <View style={styles.devSandboxSection}>
                  <AppButton
                    testID="login-dev-customer-sandbox-button"
                    variant="secondary"
                    label={t.auth.devCustomerSandboxButton}
                    loadingLabel={t.auth.submitting}
                    loading={isCustomerSandboxSubmitting}
                    disabled={isAnySubmitting}
                    onPress={handleDevCustomerSandboxPress}
                  />

                  <AppButton
                    testID="login-dev-sandbox-button"
                    variant="secondary"
                    label={t.auth.devSandboxButton}
                    loadingLabel={t.auth.submitting}
                    loading={isSandboxSubmitting}
                    disabled={isAnySubmitting}
                    onPress={handleDevSandboxPress}
                  />

                  <AppButton
                    testID="login-dev-merchant-sandbox-button"
                    variant="secondary"
                    label={t.auth.devMerchantSandboxButton}
                    loadingLabel={t.auth.submitting}
                    loading={isMerchantSandboxSubmitting}
                    disabled={isAnySubmitting}
                    onPress={handleDevMerchantSandboxPress}
                  />
                </View>
              ) : null}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.section,
    gap: Spacing.gutter,
  },
  brandHeader: {
    gap: Spacing.compact,
  },
  brandMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact + 4,
  },
  brandMeta: {
    flex: 1,
    gap: Spacing.xs,
  },
  brandName: {
    color: Colors.ink,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  noticeBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
  },
  noticeText: {
    color: Colors.danger,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter + 4,
    gap: Spacing.section,
  },
  headingBlock: {
    gap: Spacing.xs + 2,
  },
  subtitle: {
    color: Colors.muted,
  },
  fieldsStack: {
    gap: Spacing.gutter,
  },
  toggleVisibilityButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    paddingHorizontal: Spacing.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleVisibilityText: {
    color: Colors.action,
  },
  formErrorBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.compact + 4,
  },
  formErrorText: {
    color: Colors.danger,
  },
  actionsStack: {
    gap: Spacing.compact + 4,
  },
  devSandboxSection: {
    gap: Spacing.compact + 2,
    paddingTop: Spacing.xs,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
});
