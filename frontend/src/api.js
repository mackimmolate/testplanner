import axios from 'axios';
import {
  createMockEmployee,
  createMockPlanItem,
  deleteMockEmployee,
  deleteMockPlanItem,
  getMockData,
  getMockDefaultGoal,
  getMockPlan,
  updateMockPlanItem,
} from './mockApi';

const useMock =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  window.location.hostname.includes('github.io');

const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (window.location.protocol === 'file:') {
    return 'http://localhost:8000';
  }

  return '';
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

const apiWrapper = {
  get: async (url) => {
    if (useMock) {
      if (url === '/data') return getMockData();
      if (url.startsWith('/plan')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const targetDate = params.get('target_date');
        return getMockPlan(targetDate);
      }
      if (url.startsWith('/default-goal')) {
        const params = new URLSearchParams(url.split('?')[1]);
        return getMockDefaultGoal(params.get('article_id'), params.get('machine_group_id'));
      }
    }
    return api.get(url);
  },
  post: async (url, data) => {
    if (useMock) {
      if (url === '/plan') return createMockPlanItem(data);
      if (url === '/employees') return createMockEmployee(data);
    }
    return api.post(url, data);
  },
  put: async (url, data) => {
    if (useMock && url.startsWith('/plan/')) {
      const id = url.split('/').pop();
      return updateMockPlanItem(id, data);
    }
    return api.put(url, data);
  },
  delete: async (url) => {
    if (useMock) {
      if (url.startsWith('/plan/')) {
        const id = url.split('/').pop();
        return deleteMockPlanItem(id);
      }
      if (url.startsWith('/employees/')) {
        const id = url.split('/').pop();
        return deleteMockEmployee(id);
      }
    }
    return api.delete(url);
  },
};

export const isMockMode = useMock;
export default apiWrapper;
