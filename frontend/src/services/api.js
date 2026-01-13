import axios from 'axios';



// Usar variable de entorno si existe (producción), sino usar relativa (proxy dev)
// IMPORTANTE: Vite requiere que las variables empiecen con VITE_
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  updateUser: async (userId, userData) => {
    const response = await api.put(`/auth/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/auth/users/${userId}`);
    return response.data;
  },
};

// Person services
export const personService = {
  addPersonToPrivilegeGroups: async (personCode, privilegeGroupId) => {
    // Usa el endpoint correcto del backend para asignar access level
    const endpoint = '/persons/assign-access-level';
    const body = {
      personCode: String(personCode),
      privilegeGroupId: String(privilegeGroupId),
      type: 1,
    };
    console.log('POST', endpoint, body);
    const response = await api.post(endpoint, body);
    return response.data;
  },
  addPerson: async (personData) => {
    const endpoint = '/persons/add';
    console.log('POST', endpoint, personData);
    const response = await api.post(endpoint, personData);
    return response.data;
  },

  updatePerson: async (personId, personData) => {
    const endpoint = `/persons/update/${personId}`;
    console.log('PUT', endpoint, personData);
    const response = await api.put(endpoint, personData);
    return response.data;
  },

  listPersons: async (pageNo = 1, pageSize = 100, search = null) => {
    const endpoint = '/persons/list';
    const params = { page_no: pageNo, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    console.log('GET', endpoint, params);
    const response = await api.get(endpoint, { params });
    return response.data;
  },

  getPerson: async (personCode) => {
    const endpoint = `/persons/${personCode}`;
    console.log('GET', endpoint);
    const response = await api.get(endpoint);
    return response.data;
  },

  assignAccessLevel: async (personCode, privilegeGroupId) => {
    const endpoint = '/persons/assign-access-level';
    const body = {
      personCode,
      privilegeGroupId,
      type: 1,
    };
    console.log('POST', endpoint, body);
    const response = await api.post(endpoint, body);
    return response.data;
  },

  listAccessLevels: async () => {
    const endpoint = '/persons/access-levels/list';
    console.log('GET', endpoint);
    const response = await api.get(endpoint);
    return response.data;
  },

  listOrganizations: async () => {
    const endpoint = '/persons/organizations/list';
    console.log('GET', endpoint);
    const response = await api.get(endpoint);
    return response.data;
  },
};

// Audit services
export const auditService = {
  listLogs: async (page = 0, limit = 20, filters = {}) => {
    const skip = page * limit;
    let url = `/audit-logs/?skip=${skip}&limit=${limit}`;

    if (filters.userId) url += `&user_id=${filters.userId}`;
    if (filters.startDate) url += `&start_date=${filters.startDate}`;
    if (filters.endDate) url += `&end_date=${filters.endDate}`;

    const response = await api.get(url);
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/audit-logs/users');
    return response.data;
  }
};

// External services
export const externalService = {
  consultDni: async (dni) => {
    const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im9zY2FyLnBlcmV6QHZhbHRhcnNlY3VyaXR5LmNvbSJ9.CHwAiBRZUUG7b__6UNnofZZQD18A6bY2aPqzFSAiVPs';
    const response = await axios.get(`https://dniruc.apisperu.com/api/v1/dni/${dni}?token=${token}`);
    return response.data;
  }
};

export default api;
