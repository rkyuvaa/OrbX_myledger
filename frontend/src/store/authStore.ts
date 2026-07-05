import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_superuser: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User | null, accessToken: string | null, refreshToken: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  setAuth: (user, accessToken, refreshToken) => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
    
    if (accessToken) localStorage.setItem('access_token', accessToken);
    else localStorage.removeItem('access_token');

    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    else localStorage.removeItem('refresh_token');

    set({ user, accessToken, refreshToken });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, accessToken: null, refreshToken: null });
  }
}));
