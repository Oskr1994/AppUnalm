import axios from 'axios';



// Construir la URL del backend usando la IP del servidor
// Esto permite que otros dispositivos en la misma red se conecten al backend
const API_HOST = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : 'http://localhost:8000';

const API_URL = `${API_HOST}/api`;

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
};

// Person services
export const personService = {
  addPersonToPrivilegeGroups: async (personId, privilegeGroupId) => {
    // Llama directamente al endpoint del backend que debe redirigir a HikCentral
    const endpoint = '/acs/v1/privilege/group/single/addPersons';
    const body = {
      privilegeGroupId: String(privilegeGroupId),
      type: 1,
      list: [{ id: String(personId) }]
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

export default api;
