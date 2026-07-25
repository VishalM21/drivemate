import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';

// Native config (GoogleService-Info.plist / google-services.json, referenced from
// app.json) auto-initializes the default Firebase app — nothing to configure here.
export const firebaseApp = getApp();
export const firebaseAuth = getAuth(firebaseApp);
