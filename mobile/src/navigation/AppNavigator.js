import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../utils/theme';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import AddReferenceScreen from '../screens/AddReferenceScreen';
import ChatScreen from '../screens/ChatScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import AdminScreen from '../screens/AdminScreen';
import EscrowListScreen from '../screens/EscrowListScreen';
import InitiateEscrowScreen from '../screens/InitiateEscrowScreen';
import EscrowDetailScreen from '../screens/EscrowDetailScreen';
import MarkSoldScreen from '../screens/MarkSoldScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Home: '[]', Create: '+', Search: 'Q', Messages: '@', Escrow: '$', Profile: 'P', Admin: 'A' };
  return (
    <Text style={{ fontSize: 11, color: focused ? colors.primary : colors.textLight, fontWeight: focused ? '700' : '400' }}>
      {icons[label] || label.charAt(0)}
    </Text>
  );
}

function HomeTabs() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Create" component={CreateListingScreen} options={{ title: 'Post' }} />
      <Tab.Screen name="Escrow" component={EscrowListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {user?.is_admin && (
        <Tab.Screen name="Admin" component={AdminScreen} />
      )}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
        </>
      ) : !user.is_approved ? (
        <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={HomeTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Trader Profile' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'Edit Listing' }} />
          <Stack.Screen name="AddReference" component={AddReferenceScreen} options={{ title: 'Add Reference' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.name || 'Chat' })} />
          <Stack.Screen name="Messages" component={ConversationsScreen} options={{ title: 'Messages' }} />
          <Stack.Screen name="InitiateEscrow" component={InitiateEscrowScreen} options={{ title: 'New Escrow' }} />
          <Stack.Screen name="EscrowDetail" component={EscrowDetailScreen} options={{ title: 'Escrow Details' }} />
          <Stack.Screen name="MarkSold" component={MarkSoldScreen} options={{ title: 'Mark as Sold' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
