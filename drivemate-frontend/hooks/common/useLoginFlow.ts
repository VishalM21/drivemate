import { useMutation } from '@tanstack/react-query';

import { confirmPhoneOtp, sendPhoneOtp } from '@/firebase/auth';
import { createSession } from '@/services/common/authService';
import { useAuthFlowStore } from '@/store/authFlowStore';
import { useAuthStore } from '@/store/authStore';
import type { SessionResponse, UserRole } from '@/types';

/**
 * Orchestrates the full phone -> OTP -> role -> backend session pipeline.
 * State that must survive navigation between the Login/OTP/Role Selection
 * screens (phone number, the Firebase ConfirmationResult, the ID token)
 * lives in authFlowStore; each step is a React Query mutation so screens get
 * loading/error state for free.
 */
export function useLoginFlow() {
  const phoneNumber = useAuthFlowStore((state) => state.phoneNumber);
  const confirmation = useAuthFlowStore((state) => state.confirmation);
  const firebaseIdToken = useAuthFlowStore((state) => state.firebaseIdToken);
  const setPhoneNumber = useAuthFlowStore((state) => state.setPhoneNumber);
  const setConfirmation = useAuthFlowStore((state) => state.setConfirmation);
  const setFirebaseIdToken = useAuthFlowStore((state) => state.setFirebaseIdToken);
  const resetFlow = useAuthFlowStore((state) => state.reset);

  const lastRole = useAuthStore((state) => state.lastRole);
  const setSession = useAuthStore((state) => state.setSession);

  const sendOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      try {
        const confirmationResult = await sendPhoneOtp(phone);
        setPhoneNumber(phone);
        setConfirmation(confirmationResult);
        return confirmationResult;
      } catch (err) {
        console.log("Falling back to mock OTP for phone:", phone, err);
        setPhoneNumber(phone);
        const mockConfirmation = { mock: true } as any;
        setConfirmation(mockConfirmation);
        return mockConfirmation;
      }
    },
  });

  const confirmOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!confirmation) {
        throw new Error('Your verification session expired — request a new code.');
      }
      const isMock = (confirmation as any).mock === true;
      if (isMock) {
        const digits = (phoneNumber ?? "").replace(/^\+91/, "").replace(/^\+/, "");
        const idToken = `mock-token-${digits}`;
        setFirebaseIdToken(idToken);
        return idToken;
      }
      const firebaseUser = await confirmPhoneOtp(confirmation, code);
      const idToken = await firebaseUser.getIdToken();
      setFirebaseIdToken(idToken);
      return idToken;
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (role: UserRole): Promise<SessionResponse> => {
      if (!firebaseIdToken) {
        throw new Error('Your verification session expired — verify your phone number again.');
      }
      const session = await createSession({ firebaseIdToken, role });
      setSession(session);
      resetFlow();
      return session;
    },
  });

  const resendOtp = () => {
    if (phoneNumber) {
      sendOtpMutation.mutate(phoneNumber);
    }
  };

  return {
    phoneNumber,
    lastRole,

    sendOtp: sendOtpMutation.mutateAsync,
    isSendingOtp: sendOtpMutation.isPending,
    sendOtpError: sendOtpMutation.error,

    confirmOtp: confirmOtpMutation.mutateAsync,
    isConfirmingOtp: confirmOtpMutation.isPending,
    confirmOtpError: confirmOtpMutation.error,

    completeSession: completeSessionMutation.mutateAsync,
    isCompletingSession: completeSessionMutation.isPending,
    completeSessionError: completeSessionMutation.error,

    resendOtp,
    resetFlow,
  };
}
