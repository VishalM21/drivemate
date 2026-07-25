import { ApiRequestError } from '@/api/client';

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'Enter a valid phone number, including the country code.',
  'auth/missing-phone-number': 'Enter your phone number to continue.',
  'auth/too-many-requests': 'Too many attempts. Please wait a while before trying again.',
  'auth/invalid-verification-code': 'That code is incorrect. Please check and try again.',
  'auth/missing-verification-code': 'Enter the 6-digit code sent to your phone.',
  'auth/code-expired': 'This code has expired. Request a new one.',
  'auth/session-expired': 'This code has expired. Request a new one.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
};

function hasStringCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (hasStringCode(error)) {
    const mapped = FIREBASE_ERROR_MESSAGES[error.code];
    if (mapped) return mapped;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
