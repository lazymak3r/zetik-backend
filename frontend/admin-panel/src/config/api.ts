import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(new Error(error?.message || 'Request failed'));
  },
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors - token expired or invalidated
    if (error.response?.status === 401 && localStorage.getItem('adminToken')) {
      const errorMessage = error.response?.data?.message || '';

      // Show appropriate message for token invalidation
      if (errorMessage.includes('Token has been invalidated')) {
        console.warn('Session was terminated - please login again');
      } else if (errorMessage.includes('Token version mismatch')) {
        console.warn('Session expired due to security update - please login again');
      }

      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/v1/admin/login';
    }
    return Promise.reject(
      new Error(error?.response?.data?.message || error?.message || 'Request failed'),
    );
  },
);
