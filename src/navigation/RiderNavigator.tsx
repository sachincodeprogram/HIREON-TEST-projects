import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RiderTabParamList, RiderStackParamList } from './types';
import { COLORS } from '../constants/api';
import CustomTabBar from '../components/navigation/CustomTabBar';

import RiderDashboard       from '../screens/rider/RiderDashboard';
import RiderOrderHistory    from '../screens/rider/RiderOrderHistoryScreen';
import EarningsScreen       from '../screens/rider/EarningsScreen';
import RiderProfileScreen   from '../screens/rider/RiderProfileScreen';
import ActiveDeliveryScreen from '../screens/rider/ActiveDeliveryScreen';
import NavigationScreen     from '../screens/rider/NavigationScreen';
import WalletScreen         from '../screens/rider/WalletScreen';

const Tab   = createBottomTabNavigator<RiderTabParamList>();
const Stack = createNativeStackNavigator<RiderStackParamList>();

const RiderTabs = () => (
  <Tab.Navigator
    tabBar={props => <CustomTabBar {...props} accent={COLORS.secondary} />}
    screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Dashboard" component={RiderDashboard}      options={{ title: 'Home' }} />
    <Tab.Screen name="History"   component={RiderOrderHistory}   options={{ title: 'History' }} />
    <Tab.Screen name="Earnings"  component={EarningsScreen}      options={{ title: 'Earnings' }} />
    <Tab.Screen name="Profile"   component={RiderProfileScreen}  options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

const RiderNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="RiderTabs"      component={RiderTabs} />
    <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="Navigation"     component={NavigationScreen}     options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="Wallet"         component={WalletScreen}         options={{ animation: 'slide_from_right' }} />
  </Stack.Navigator>
);

export default RiderNavigator;
