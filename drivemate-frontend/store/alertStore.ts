import { create } from 'zustand';

export interface AlertButtonSpec {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButtonSpec[];
}

interface AlertActions {
  show: (title: string, message?: string, buttons?: AlertButtonSpec[]) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState & AlertActions>()((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [{ text: 'OK' }],

  show: (title, message, buttons) =>
    set({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    }),
  hide: () => set({ visible: false }),
}));
