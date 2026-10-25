import axios from 'axios';

const getBaseUrl = () => {
  let url = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
};

const api = axios.create({ baseURL: getBaseUrl() });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('queuewise_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
