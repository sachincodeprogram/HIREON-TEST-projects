import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS } from '../../constants/api';
import { useTranslation, TranslationKey } from '../../i18n';
import { OrderStatus } from '../../types';

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status] || '#64748B';
  const key   = `status.${status}` as TranslationKey;
  return (
    <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{t(key)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default StatusBadge;
