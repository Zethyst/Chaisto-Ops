import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store, persistor } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { fcmService } from './src/services/fcmService';
import { COLORS } from './src/constants';
import { LanguageProvider } from './src/i18n';

LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

fcmService.setupBackgroundHandler();

export default function App() {
  useEffect(() => {
    // Register FCM token once the app mounts (user must be logged in for this to persist server-side)
    fcmService.registerToken().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <LanguageProvider>
              <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
              <AppNavigator />
              <Toast />
            </LanguageProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
