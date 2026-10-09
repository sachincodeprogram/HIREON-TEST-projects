import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import auth from '@react-native-firebase/auth';
import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { LanguageProvider } from './src/i18n';

if (__DEV__) {
  LogBox.ignoreAllLogs();
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <Provider store={store}>
          <RootNavigator />
        </Provider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

export default App;
