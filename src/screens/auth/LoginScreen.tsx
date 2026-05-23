import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../../store/slices/authSlice';
import { AppDispatch, RootState } from '../../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { haptics } from '../../utils/haptics';
import BrandedLogoMark from '../../components/BrandedLogoMark';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error, [
        { text: 'OK', onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error]);

  const handleLogin = () => {
    if (!phone.trim() || !password.trim()) {
      haptics.error();
      Alert.alert('Missing Fields', 'Please enter your phone number and password.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      haptics.error();
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    haptics.medium();
    dispatch(loginUser({ phone: phone.trim(), password }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Decorative orb */}
      <View style={styles.orb1} />

      <View style={styles.inner}>
        {/* Logo Area */}
        <View style={styles.logoArea}>
          <View style={styles.logoMarkWrap}>
            <BrandedLogoMark />
          </View>
          <Text style={styles.appName}>CHAISTO OPS</Text>
          <Text style={styles.tagline}>Cart Management System</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>Enter your credentials to access the portal</Text>

          <View style={styles.field}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                autoComplete="tel"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helpRow}>
            <Text style={styles.helpText}>Forgot password? Contact Akshat Jaiswal.</Text>
          </View>
        </View>

        {/* Security notice */}
        <View style={styles.securityBadge}>
          <Text style={styles.securityText}>🔒 Secured · GPS-tracked · Device-bound</Text>
        </View>

        <Text style={styles.version}>ChaistoOps v1.0 · Civil Lines, Prayagraj</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primaryBg,
    top: -100,
    right: -80,
    opacity: 0.6,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoMarkWrap: {
    marginBottom: SPACING.lg,
  },
  appName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.medium,
    marginTop: 6,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.muted,
    marginBottom: SPACING.xl,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 11,
    color: COLORS.primaryLight,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    letterSpacing: 1.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  countryCode: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primaryLight,
    marginRight: SPACING.sm,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.black,
    paddingVertical: SPACING.md,
  },
  eyeBtn: {
    paddingLeft: SPACING.md,
  },
  eyeText: {
    fontSize: 18,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
  helpRow: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  helpText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.muted,
  },
  securityBadge: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  securityText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontSize: 11,
    color: COLORS.muted,
  },
});
