import { registerRootComponent } from 'expo';
import 'react-native-url-polyfill/auto';
import { createElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import App from './App';
import { initMonitoring } from './src/observability/monitoring';

initMonitoring();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
function Root() {
  return createElement(GestureHandlerRootView, { style: { flex: 1 } }, createElement(App));
}

registerRootComponent(Root);
