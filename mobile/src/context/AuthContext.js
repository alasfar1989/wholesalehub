import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../services/api';
import { navigate } from '../navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const AuthContext = createContext(null);

async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token.data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    checkAuth();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Notification received while app is open - handled by setNotificationHandler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'escrow' && data?.escrowId) {
        navigate('EscrowDetail', { id: data.escrowId });
      } else if (data?.type === 'message' && data?.userId) {
        navigate('Chat', { userId: data.userId, name: data.name || 'Chat' });
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  async function checkAuth() {
    try {
      await api.init();
      if (api.token) {
        const data = await api.getMe();
        setUser(data.user);
        // Register push token after auth
        registerPushToken();
      }
    } catch {
      await api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function registerPushToken() {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await api.updatePushToken(token);
      }
    } catch (err) {
      console.log('Push token registration failed:', err.message);
    }
  }

  async function login(phone, password) {
    const data = await api.login({ phone, password });
    await api.setToken(data.token);
    setUser(data.user);
    registerPushToken();
    return data.user;
  }

  async function signup(body) {
    const data = await api.signup(body);
    await api.setToken(data.token);
    setUser(data.user);
    registerPushToken();
    return data.user;
  }

  async function logout() {
    // Clear push token on server
    try {
      await api.updatePushToken(null);
    } catch {}
    await api.setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    const data = await api.getMe();
    setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
