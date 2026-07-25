import {
  getIdToken,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';

import { firebaseAuth } from './firebaseConfig';

export type FirebaseUser = User;
export type PhoneAuthConfirmation = ConfirmationResult;

export function subscribeToFirebaseAuthState(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

export function sendPhoneOtp(phoneNumber: string): Promise<PhoneAuthConfirmation> {
  return signInWithPhoneNumber(firebaseAuth, phoneNumber);
}

export async function confirmPhoneOtp(
  confirmation: PhoneAuthConfirmation,
  code: string,
): Promise<FirebaseUser> {
  const credential = await confirmation.confirm(code);
  if (!credential?.user) {
    throw new Error('Invalid verification code');
  }
  return credential.user;
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
  return firebaseAuth.currentUser;
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return getIdToken(user, forceRefresh);
}

export function signOutFirebase(): Promise<void> {
  return signOut(firebaseAuth);
}
