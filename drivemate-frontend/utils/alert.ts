import { useAlertStore, type AlertButtonSpec } from '@/store/alertStore';

/** Drop-in replacement for RN's `Alert.alert` that renders a themed in-app
 * dialog (matching the app's design) instead of the platform's default
 * system alert. Same call signature: showAlert(title, message?, buttons?). */
export function showAlert(title: string, message?: string, buttons?: AlertButtonSpec[]) {
  useAlertStore.getState().show(title, message, buttons);
}
