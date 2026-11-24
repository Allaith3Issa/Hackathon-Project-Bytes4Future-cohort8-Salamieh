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
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppInput, BrandMark, StatusBadge } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle, getMirrorTransform } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useRegisterForm } from '@/features/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const reducedMotion = useReducedMotion();

  const phoneInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shopDetailsInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    name,
    phone,
    password,
    includesCustomer,
    includesMarketer,
    includesMerchant,
    shopName,
    shopDetails,
    setName,
    setPhone,
    setPassword,
    toggleRole,
    setShopName,
    setShopDetails,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
  } = useRegisterForm();

  useAndroidBack({
    isBusy: isSubmitting,
    isRootTab: false,
  });

  const directionalText = getDirectionalTextStyle(locale);
  const layoutTransition = reducedMotion ? undefined : LinearTransition.duration(200);

  const handleGoBack = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login' as Href);
    }
  }, [isSubmitting, router]);

  const handleTogglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible((prev) => !prev);
  }, []);

  const handleRegisterPress = useCallback(() => {
    void submit();
  }, [submit]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          testID="register-back-button"
          disabled={isSubmitting}
          onPress={handleGoBack}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          accessibilityState={{ disabled: isSubmitting }}
          style={[styles.backButton, isSubmitting ? styles.backButtonDisabled : null]}
        >
          <Text style={[styles.backChevron, getMirrorTransform(locale)]}>{'‹'}</Text>
          <Text style={[Typography.label, directionalText, styles.backLabel]}>
            {t.common.back}
          </Text>
        </Pressable>

        <Text
          style={[Typography.section, directionalText, styles.topBarTitle]}
          numberOfLines={1}
        >
          {t.auth.registerTitle}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>

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
            entering={reducedMotion ? undefined : FadeInDown.duration(220)}
            style={styles.brandHeader}
          >
            <BrandMark testID="register-brand-mark" size="md" decorative />
            <View style={styles.brandMeta}>
              <Text style={[Typography.section, directionalText]}>
                {t.common.appName}
              </Text>
              <View style={styles.badgesRow}>
                <StatusBadge label={t.profile.roleCustomer} tone="success" showDot />
                <StatusBadge label={t.profile.roleMarketer} tone="mauve" showDot />
                <StatusBadge label={t.profile.roleMerchant} tone="info" showDot />
              </View>
            </View>
          </Animated.View>

          <Animated.View
            layout={layoutTransition}
            entering={reducedMotion ? undefined : FadeInDown.delay(40).duration(240)}
            style={styles.formCard}
          >
            <View style={styles.headingBlock}>
              <Text style={[Typography.display, directionalText]}>
                {t.auth.registerTitle}
              </Text>
              <Text style={[Typography.body, directionalText, styles.subtitle]}>
                {t.auth.registerSubtitle}
              </Text>
            </View>

            <View style={styles.fieldsStack}>
              <AppInput
                testID="register-name-input"
                label={t.auth.nameLabel}
                placeholder={t.auth.namePlaceholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                returnKeyType="next"
                editable={!isSubmitting}
                onSubmitEditing={() => phoneInputRef.current?.focus()}
                error={fieldErrors.name}
              />

              <AppInput
                ref={phoneInputRef}
                testID="register-phone-input"
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
                editable={!isSubmitting}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                error={fieldErrors.phone}
              />

              <AppInput
                ref={passwordInputRef}
                testID="register-password-input"
                label={t.auth.passwordLabel}
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType={includesMerchant ? 'next' : 'done'}
                editable={!isSubmitting}
                onSubmitEditing={includesMerchant ? undefined : handleRegisterPress}
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

            <View style={styles.rolesSection}>
              <Text style={[Typography.label, directionalText]}>
                {t.auth.rolesLabel}
              </Text>

              <View style={styles.rolesList}>
                <Pressable
                  testID="register-role-customer"
                  disabled={isSubmitting}
                  onPress={() => toggleRole('customer')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: includesCustomer, disabled: isSubmitting }}
                  accessibilityLabel={t.auth.roleCustomerOption}
                  style={[
                    styles.roleCard,
                    includesCustomer ? styles.roleCardSelected : null,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      includesCustomer ? styles.checkboxBoxChecked : null,
                    ]}
                    accessible={false}
                  >
                    {includesCustomer ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.roleCopy}>
                    <Text style={[Typography.label, directionalText, styles.roleTitle]}>
                      {t.auth.roleCustomerOption}
                    </Text>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.auth.roleCustomerHint}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  testID="register-role-marketer"
                  disabled={isSubmitting}
                  onPress={() => toggleRole('marketer')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: includesMarketer, disabled: isSubmitting }}
                  accessibilityLabel={t.auth.roleMarketerOption}
                  style={[
                    styles.roleCard,
                    includesMarketer ? styles.roleCardSelected : null,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      includesMarketer ? styles.checkboxBoxChecked : null,
                    ]}
                    accessible={false}
                  >
                    {includesMarketer ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.roleCopy}>
                    <Text style={[Typography.label, directionalText, styles.roleTitle]}>
                      {t.auth.roleMarketerOption}
                    </Text>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.auth.roleMarketerHint}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  testID="register-role-merchant"
                  disabled={isSubmitting}
                  onPress={() => toggleRole('merchant')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: includesMerchant, disabled: isSubmitting }}
                  accessibilityLabel={t.auth.roleMerchantOption}
                  style={[
                    styles.roleCard,
                    includesMerchant ? styles.roleCardSelected : null,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      includesMerchant ? styles.checkboxBoxChecked : null,
                    ]}
                    accessible={false}
                  >
                    {includesMerchant ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.roleCopy}>
                    <Text style={[Typography.label, directionalText, styles.roleTitle]}>
                      {t.auth.roleMerchantOption}
                    </Text>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.auth.roleMerchantHint}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {fieldErrors.roles ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[Typography.caption, directionalText, styles.fieldErrorText]}
                >
                  {fieldErrors.roles}
                </Text>
              ) : null}
            </View>

            {includesMerchant ? (
              <Animated.View
                entering={reducedMotion ? undefined : FadeInDown.duration(220)}
                exiting={reducedMotion ? undefined : FadeOutUp.duration(160)}
                layout={layoutTransition}
                style={styles.shopSection}
              >
                <AppInput
                  testID="register-shop-name-input"
                  label={t.auth.shopNameLabel}
                  placeholder={t.auth.shopNamePlaceholder}
                  value={shopName}
                  onChangeText={setShopName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!isSubmitting}
                  onSubmitEditing={() => shopDetailsInputRef.current?.focus()}
                  error={fieldErrors.shopName}
                />

                <AppInput
                  ref={shopDetailsInputRef}
                  testID="register-shop-details-input"
                  label={t.auth.shopDetailsLabel}
                  placeholder={t.auth.shopDetailsPlaceholder}
                  value={shopDetails}
                  onChangeText={setShopDetails}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  inputStyle={styles.multilineInput}
                  editable={!isSubmitting}
                  error={fieldErrors.shopDetails}
                />
              </Animated.View>
            ) : null}

            {formError ? (
              <View accessibilityLiveRegion="polite" style={styles.formErrorBox}>
                <Text style={[Typography.label, directionalText, styles.formErrorText]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <Animated.View layout={layoutTransition} style={styles.actionsStack}>
              <AppButton
                testID="register-submit-button"
                variant="primary"
                label={t.auth.registerSubmit}
                loadingLabel={t.auth.registerSubmitting}
                loading={isSubmitting}
                disabled={isSubmitting}
                haptic="medium"
                onPress={handleRegisterPress}
              />

              <AppButton
                testID="register-have-account-link"
                variant="ghost"
                label={t.auth.haveAccountLink}
                disabled={isSubmitting}
                haptic="light"
                onPress={handleGoBack}
              />
            </Animated.View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.compact,
    paddingVertical: Spacing.xs,
    borderBottomWidth: BorderWidth.hairline,
    borderBottomColor: Colors.rule,
    backgroundColor: Colors.canvas,
    gap: Spacing.compact,
  },
  backButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
    borderRadius: Radii.control,
    gap: Spacing.xs,
  },
  backButtonDisabled: {
    opacity: 0.45,
  },
  backChevron: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.ink,
  },
  backLabel: {
    color: Colors.ink,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.ink,
  },
  topBarSpacer: {
    minWidth: TouchTarget.minWidth,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.section,
    gap: Spacing.gutter,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact + 4,
  },
  brandMeta: {
    flex: 1,
    gap: Spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact,
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
  rolesSection: {
    gap: Spacing.compact + 2,
  },
  rolesList: {
    gap: Spacing.compact + 2,
  },
  roleCard: {
    minHeight: TouchTarget.minHeight + 8,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.canvas,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.compact + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact + 4,
  },
  roleCardSelected: {
    backgroundColor: Colors.mauveTint,
    borderColor: Colors.action,
    borderWidth: BorderWidth.focus,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: BorderWidth.focus,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxBoxChecked: {
    borderColor: Colors.action,
    backgroundColor: Colors.action,
  },
  checkboxMark: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 16,
    color: Colors.onInk,
  },
  roleCopy: {
    flex: 1,
    gap: 2,
  },
  roleTitle: {
    color: Colors.ink,
  },
  fieldErrorText: {
    color: Colors.danger,
  },
  shopSection: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 12,
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
});
