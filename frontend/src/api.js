import axios from 'axios';
import {
    getMockData,
    getMockPlan,
    createMockPlanItem,
    updateMockPlanItem,
    deleteMockPlanItem,
    getMockDefaultGoal
} from './mockApi';

// Determine if we should use mock mode
// Check env var or if we are on github pages (hostname ends with github.io)
const useMock = import.meta.env.VITE_USE_MOCK === 'true' || window.location.hostname.includes('github.io');

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Wrap API calls to switch between real and mock
const apiWrapper = {
    get: async (url) => {
        if (useMock) {
            if (url === '/data') return getMockData();
            if (url.startsWith('/plan')) {
                // Parse target_date from query string
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
        }
        return api.post(url, data);
    },
    put: async (url, data) => {
        if (useMock) {
            if (url.startsWith('/plan/')) {
                const id = url.split('/').pop();
                return updateMockPlanItem(id, data);
            }
        }
        return api.put(url, data);
    },
    delete: async (url) => {
        if (useMock) {
            if (url.startsWith('/plan/')) {
                const id = url.split('/').pop();
                return deleteMockPlanItem(id);
            }
        }
        return api.delete(url);
    }
};

export const isMockMode = useMock;
export default apiWrapper;
