import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    let url = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
    return url.endsWith('/api') ? url : `${url}/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://intelligent-queue-management.onrender.com/api';
  }
  return 'http://localhost:5000/api';
};

const api = axios.create({ baseURL: getBaseUrl(), timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('queuewise_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
