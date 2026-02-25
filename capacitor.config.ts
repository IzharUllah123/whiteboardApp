import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.edxly.whiteBoard',
  appName: 'WhiteBoard',
  webDir: 'dist',
  server: {
    // This tells the app its home is your Vercel site, not localhost
    hostname: 'white-board2026.vercel.app',
    androidScheme: 'https'
  }
};

export default config;