import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { SocketProvider } from './src/context/SocketContext';

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider> 
      <AppNavigator />
      </SocketProvider> 
    </AuthProvider>
  );
};

export default App;