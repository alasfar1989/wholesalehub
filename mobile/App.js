import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';

// Deep linking: wholesalehub://listing/<id> and https://<domain>/listing/<id>
// open the listing directly. The https (universal/app link) form only works
// once a native build ships with the associated-domains / intent-filter config
// in app.json — until then these prefixes are harmless no-ops.
const linking = {
  prefixes: [
    'wholesalehub://',
    'https://wholesalehub-production-25ae.up.railway.app',
  ],
  config: {
    screens: {
      ListingDetail: 'listing/:id',
    },
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
