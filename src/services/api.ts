// src/services/api.ts
import axios from 'axios';
import type { APIResponse, SSLCertificate } from '../types';

// 設定後端地址
const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
});

// [新增] Request Interceptor: 自動帶上 Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// [新增] Response Interceptor: 處理 401 過期
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token 失效，清除並跳轉
            localStorage.removeItem('token');
            // 因為這裡不是 React Component，我們直接用 window.location 跳轉
            // 或者您可以只拋出錯誤，讓 Component 處理
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// 修改 fetchDomains 增加 status 參數
export const fetchDomains = async (page = 1, limit = 10, sort = '', status = '', proxied = '', ignored = '', zone = '') => {
    const response = await api.get<APIResponse<SSLCertificate[]>>('/domains', {
        params: { page, limit, sort, status, proxied, ignored, zone } // 傳送給後端
    });
    return response.data;
};

export const syncDomains = async () => {
    return api.post('/domains/sync');
};

export const scanDomains = async () => {
    return api.post('/domains/scan');
};

// [新增] 更新是否忽略
export const updateDomainSettings = async (id: string, isIgnored: boolean) => {
    return api.patch(`/domains/${id}/settings`, { is_ignored: isIgnored });
};
// [新增] 獲取主域名列表
export const fetchZones = async () => {
    const response = await api.get<{ data: string[] }>('/zones');
    return response.data.data;
};

// 儲存設定
export const saveSettings = async (settings: NotificationSettings) => {
    return api.post('/settings', settings);
};

// 測試設定 (傳入當前表單的值)
export const testNotification = async (settings: NotificationSettings) => {
    return api.post('/settings/test', settings);
};

// 獲取設定的回傳值也要改
export const getSettings = async () => {
    const res = await api.get<{ data: NotificationSettings }>('/settings');
    return res.data.data;
};

// 定義設定的型別
export interface NotificationSettings {
    webhook_enabled: boolean;
    webhook_url: string;
    telegram_enabled: boolean;
    telegram_bot_token: string;
    telegram_chat_id: string;
}

// 定義型別
export interface DashboardStats {
    total_domains: number;
    status_counts: Record<string, number>;
    expiry_counts: Record<string, number>;
    issuer_counts: Record<string, number>;
}

// 新增 API
export const fetchStats = async () => {
    const res = await api.get<{ data: DashboardStats }>('/stats');
    return res.data.data;
};

// 新增 ACME 設定的 API
export const saveAcmeEmail = async (email: string) => {
    return api.post('/settings/acme', { email });
};

export const renewCert = async (domain: string) => {
    return api.post('/domains/renew', { domain });
};