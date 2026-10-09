import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomerTabParamList, CustomerStackParamList } from './types';
import { COLORS } from '../constants/api';
import CustomTabBar from '../components/navigation/CustomTabBar';
import { useTranslation } from '../i18n';

import CustomerDashboard     from '../screens/customer/CustomerDashboard';
import BookParcelScreen      from '../screens/customer/BookParcelScreen';
import OrderHistoryScreen    from '../screens/customer/OrderHistoryScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import FareEstimateScreen    from '../screens/customer/FareEstimateScreen';
import LiveTrackingScreen    from '../screens/customer/LiveTrackingScreen';

const Tab   = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

const CustomerTabs = () => {
  const { t } = useTranslation();
  return (
  <Tab.Navigator
    tabBar={props => <CustomTabBar {...props} accent={COLORS.primary} />}
    screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Dashboard"  component={CustomerDashboard}     options={{ title: t('tabs.home') }} />
    <Tab.Screen name="BookParcel" component={BookParcelScreen}      options={{ title: t('tabs.book') }} />
    <Tab.Screen name="History"    component={OrderHistoryScreen}    options={{ title: t('tabs.orders') }} />
    <Tab.Screen name="Profile"    component={CustomerProfileScreen} options={{ title: t('tabs.profile') }} />
  </Tab.Navigator>
  );
};

const CustomerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
    <Stack.Screen name="FareEstimate" component={FareEstimateScreen} options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ animation: 'slide_from_bottom' }} />
  </Stack.Navigator>
);

export default CustomerNavigator;
