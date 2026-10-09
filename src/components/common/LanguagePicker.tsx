import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ToastAndroid, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/api';
import { RADIUS, ELEVATION } from '../../constants/theme';
import { LANGUAGES, Language, useTranslation, translate } from '../../i18n';
import Card from './Card';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  accent?: string;
}

// Bottom sheet — har language apne hi script me (English / हिन्दी) dikhti hai,
// taaki jo user abhi wali language na padh paaye wo bhi apni pehchaan le.
export const LanguageSheet: React.FC<SheetProps> = ({ visible, onClose, accent = COLORS.primary }) => {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useTranslation();

  const handleSelect = async (code: Language) => {
    if (code !== language) {
      await setLanguage(code);
      if (Platform.OS === 'android') {
        ToastAndroid.show(translate('language.changed'), ToastAndroid.SHORT);
      }
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Sheet ke andar tap scrim tak na pahunche */}
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('language.sheetTitle')}</Text>
          <Text style={styles.sheetHint}>{t('language.sheetHint')}</Text>

          {LANGUAGES.map(lang => {
            const active = lang.code === language;
            return (
              <TouchableOpacity
                key={lang.code}
                activeOpacity={0.8}
                onPress={() => handleSelect(lang.code)}
                style={[styles.option, active && { borderColor: accent, backgroundColor: accent + '0D' }]}>
                <View style={[styles.optionBadge, { backgroundColor: active ? accent : COLORS.surface2 }]}>
                  <Text style={[styles.optionBadgeText, { color: active ? '#fff' : COLORS.textMuted }]}>
                    {lang.code === 'hi' ? 'अ' : 'A'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionNative, active && { color: accent }]}>{lang.nativeName}</Text>
                  {lang.englishName !== lang.nativeName && (
                    <Text style={styles.optionEnglish}>{lang.englishName}</Text>
                  )}
                </View>
                <View style={[styles.radioOuter, active && { borderColor: accent }]}>
                  {active && <View style={[styles.radioInner, { backgroundColor: accent }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Profile screen ki settings row — tap karne par LanguageSheet khulti hai.
export const LanguageSettingRow: React.FC<{ accent?: string }> = ({ accent = COLORS.primary }) => {
  const { language, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  return (
    <>
      <Card onPress={() => setOpen(true)} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: accent + '14' }]}>
          <Text style={[styles.rowIconText, { color: accent }]}>अA</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t('language.title')}</Text>
          <Text style={styles.rowSub}>{t('language.subtitle')}</Text>
        </View>
        <Text style={[styles.rowValue, { color: accent }]}>{current.nativeName}</Text>
        <Text style={styles.rowArrow}>›</Text>
      </Card>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} accent={accent} />
    </>
  );
};

// Login jaisi screens ke header ke liye chhota pill (light text, dark bg par).
export const LanguagePill: React.FC = () => {
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.pillIcon}>अA</Text>
        <Text style={styles.pillText}>{current.nativeName}</Text>
        <Text style={styles.pillCaret}>▾</Text>
      </TouchableOpacity>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  // ── Sheet ──
  scrim: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: 20, paddingTop: 10,
    ...ELEVATION.lg,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.borderDark, marginBottom: 18,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  sheetHint:  { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 18, lineHeight: 19 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  optionBadge: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  optionBadgeText: { fontSize: 18, fontWeight: '800' },
  optionNative:    { fontSize: 16, fontWeight: '800', color: COLORS.text },
  optionEnglish:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderDark,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 11, height: 11, borderRadius: 6 },

  // ── Settings row ──
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconText: { fontSize: 15, fontWeight: '900' },
  rowTitle:    { fontSize: 15, fontWeight: '800', color: COLORS.text },
  rowSub:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  rowValue:    { fontSize: 13, fontWeight: '700' },
  rowArrow:    { fontSize: 26, color: COLORS.textLight, fontWeight: '300', marginLeft: 2 },

  // ── Pill ──
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  pillIcon:  { fontSize: 12, fontWeight: '900', color: '#fff' },
  pillText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  pillCaret: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
});
