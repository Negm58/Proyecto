const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
      // Si el token expiró o es inválido, limpiar sesión excepto si estamos intentando hacer login
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
      }
    }

    // Para descargas de archivos binarios/blob
    if (options.responseType === 'blob') {
      if (!response.ok) throw new Error('Error al descargar archivo');
      return response.blob();
    }

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || 'Error en la solicitud al servidor');
      error.details = data.details;
      error.status = response.status;
      throw error;
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};
