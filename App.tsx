import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PuzzleScreen from './src/PuzzleScreen';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PuzzleScreen />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
