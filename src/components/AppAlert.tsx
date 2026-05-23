import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  StyleSheet, Dimensions,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'sheet';
  buttons?: AlertButton[];
}

// ── Auto-detect type from title keywords ─────────────────────────────────────

function resolveType(opts: AlertOptions): NonNullable<AlertOptions['type']> {
  if (opts.type) return opts.type;
  if (opts.buttons?.some((b) => b.style === 'destructive')) return 'confirm';
  const t = opts.title.toLowerCase();
  if (/error|failed|fail|cannot|could not|unreachable|denied/.test(t)) return 'error';
  if (/invalid|missing|weak|mismatch|required|permission/.test(t)) return 'warning';
  if (/saved|done|success|created|updated|cleared|captured|submitted/.test(t)) return 'success';
  if (/exit|reset|delete|disable|enable|sign out|confirm|submit|block|restore/.test(t)) return 'confirm';
  if (/already|locked/.test(t)) return 'warning';
  return 'info';
}

const TYPE: Record<string, { icon: string; accent: string; headerBg: string }> = {
  success: { icon: '✅', accent: COLORS.success, headerBg: COLORS.successBg },
  error:   { icon: '❌', accent: COLORS.danger,  headerBg: COLORS.dangerBg  },
  warning: { icon: '⚠️', accent: COLORS.warning, headerBg: COLORS.warningBg },
  info:    { icon: 'ℹ️', accent: COLORS.info,    headerBg: COLORS.infoBg    },
  confirm: { icon: '❓', accent: COLORS.primary,  headerBg: COLORS.primaryBg },
  sheet:   { icon: '',   accent: COLORS.primary,  headerBg: COLORS.white     },
};

// ── Imperative bridge ────────────────────────────────────────────────────────

type ShowFn = (opts: AlertOptions) => void;
let _imperativeShow: ShowFn | null = null;

export function registerAlertHandler(fn: ShowFn) { _imperativeShow = fn; }

/** Drop-in replacement for Alert.alert — works outside React components too. */
export function showAlert(
  titleOrOpts: string | AlertOptions,
  message?: string,
  buttons?: AlertButton[],
) {
  if (!_imperativeShow) return;
  if (typeof titleOrOpts === 'object') {
    _imperativeShow(titleOrOpts);
  } else {
    _imperativeShow({
      title: titleOrOpts,
      message,
      buttons: buttons ?? [{ text: 'OK' }],
    });
  }
}

// ── Context (optional hook API) ───────────────────────────────────────────────

const AlertCtx = createContext<ShowFn>(() => {});
export const useAlert = () => useContext(AlertCtx);

// ── Provider + Modal ─────────────────────────────────────────────────────────

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<AlertOptions & { resolvedType: string }>({
    title: '', resolvedType: 'info',
  });

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.88)).current;
  const sheetTranslate = useRef(new Animated.Value(400)).current;

  const show = useCallback<ShowFn>((options) => {
    const resolvedType = resolveType(options);
    setOpts({ ...options, resolvedType });
    setVisible(true);
    backdropOpacity.setValue(0);

    if (resolvedType === 'sheet') {
      sheetTranslate.setValue(400);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslate, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
    } else {
      cardScale.setValue(0.88);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  const dismiss = useCallback((onPress?: () => void) => {
    const isSheet = opts.resolvedType === 'sheet';
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      isSheet
        ? Animated.timing(sheetTranslate, { toValue: 400, duration: 200, useNativeDriver: true })
        : Animated.timing(cardScale, { toValue: 0.88, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      onPress?.();
    });
  }, [opts.resolvedType]);

  // Register imperative bridge
  useEffect(() => {
    registerAlertHandler(show);
    return () => { _imperativeShow = null; };
  }, [show]);

  const cfg = TYPE[opts.resolvedType] ?? TYPE.info;
  const buttons = opts.buttons?.length ? opts.buttons : [{ text: 'OK' }];
  const isSheet = opts.resolvedType === 'sheet';
  const actionBtns = buttons.filter((b) => b.style !== 'cancel');
  const cancelBtns = buttons.filter((b) => b.style === 'cancel');

  return (
    <AlertCtx.Provider value={show}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => dismiss()}
      >
        {/* Dimmed backdrop */}
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => dismiss()} activeOpacity={1} />
        </Animated.View>

        {isSheet ? (
          /* ── Action Sheet ── */
          <View style={s.sheetContainer}>
            <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
              <View style={s.sheetHandle} />
              {opts.title ? (
                <Text style={s.sheetTitle}>{opts.title}</Text>
              ) : null}

              {/* Action options */}
              <View style={s.sheetActions}>
                {actionBtns.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.sheetActionRow, i > 0 && s.sheetRowBorder]}
                    onPress={() => dismiss(btn.onPress)}
                    activeOpacity={0.65}
                  >
                    <Text style={[s.sheetActionText, btn.style === 'destructive' && { color: COLORS.danger }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cancel */}
              {cancelBtns.map((btn, i) => (
                <TouchableOpacity
                  key={`c${i}`}
                  style={s.sheetCancelRow}
                  onPress={() => dismiss(btn.onPress)}
                  activeOpacity={0.65}
                >
                  <Text style={s.sheetCancelText}>{btn.text}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        ) : (
          /* ── Alert Dialog ── */
          <View style={s.center}>
            <Animated.View style={[s.card, { transform: [{ scale: cardScale }], opacity: backdropOpacity }]}>
              {/* Coloured icon header */}
              <View style={[s.iconHeader, { backgroundColor: cfg.headerBg }]}>
                <Text style={s.iconEmoji}>{cfg.icon}</Text>
              </View>

              {/* Text */}
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{opts.title}</Text>
                {opts.message ? (
                  <Text style={s.cardMessage}>{opts.message}</Text>
                ) : null}
              </View>

              {/* Divider */}
              <View style={s.divider} />

              {/* Buttons */}
              <View style={[s.btnRow, buttons.length > 2 && s.btnCol]}>
                {buttons.map((btn, i) => {
                  const isCancel      = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  const isPrimary     = !isCancel && !isDestructive;
                  const solo          = buttons.length === 1;
                  const showRightBorder  = buttons.length === 2 && i === 0;
                  const showBottomBorder = buttons.length > 2 && i < buttons.length - 1;

                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        s.btn,
                        showRightBorder  && s.btnBorderRight,
                        showBottomBorder && s.btnBorderBottom,
                        isPrimary && solo && { backgroundColor: cfg.accent },
                      ]}
                      onPress={() => dismiss(btn.onPress)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        s.btnText,
                        isCancel      && s.btnCancel,
                        isDestructive && s.btnDestructive,
                        isPrimary && !solo && { color: cfg.accent, fontWeight: '700' },
                        isPrimary && solo  && s.btnSolid,
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        )}
      </Modal>
    </AlertCtx.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  // Alert dialog
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  iconHeader: {
    paddingVertical: SPACING.xl + 4,
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 48,
  },
  cardBody: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  cardMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.medium,
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.borderLight,
  },
  btnRow: {
    flexDirection: 'row',
  },
  btnCol: {
    flexDirection: 'column',
  },
  btn: {
    flex: 1,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  btnBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  btnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  btnCancel: {
    color: COLORS.muted,
    fontWeight: '500',
  },
  btnDestructive: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  btnSolid: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },

  // Action sheet
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 14,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  sheetActions: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetActionRow: {
    paddingVertical: SPACING.lg + 2,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  sheetRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  sheetActionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sheetCancelRow: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetCancelText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
