// src/services/api.ts
import axios from 'axios';
import type { APIResponse, SSLCertificate } from '../types';

// 設定後端地址
const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
});

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
