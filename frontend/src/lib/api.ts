import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add access token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh_token = useAuthStore.getState().refreshToken;
        if (!refresh_token) {
          throw new Error('No refresh token available');
        }
        
        // Refresh token endpoint
        const response = await axios.post('/api/v1/auth/refresh', { refresh_token });
        const { access_token, refresh_token: new_refresh_token } = response.data;
        
        // Update store
        const user = useAuthStore.getState().user;
        useAuthStore.getState().setAuth(user, access_token, new_refresh_token);
        
        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Clear auth and logout if refresh fails
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
