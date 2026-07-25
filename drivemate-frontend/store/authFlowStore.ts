import { create } from 'zustand';

import type { PhoneAuthConfirmation } from '@/firebase/auth';

// Ephemeral, in-memory only — a ConfirmationResult can't be persisted, and
// this flow state shouldn't survive an app restart anyway.
interface AuthFlowState {
  phoneNumber: string | null;
  confirmation: PhoneAuthConfirmation | null;
  firebaseIdToken: string | null;
}

interface AuthFlowActions {
  setPhoneNumber: (phoneNumber: string) => void;
  setConfirmation: (confirmation: PhoneAuthConfirmation) => void;
  setFirebaseIdToken: (firebaseIdToken: string) => void;
  reset: () => void;
}

type AuthFlowStore = AuthFlowState & AuthFlowActions;

const initialState: AuthFlowState = {
  phoneNumber: null,
  confirmation: null,
  firebaseIdToken: null,
};

export const useAuthFlowStore = create<AuthFlowStore>()((set) => ({
  ...initialState,
  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  setConfirmation: (confirmation) => set({ confirmation }),
  setFirebaseIdToken: (firebaseIdToken) => set({ firebaseIdToken }),
  reset: () => set(initialState),
}));
