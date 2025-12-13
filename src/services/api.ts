// src/services/api.ts
import axios from 'axios';
import type { APIResponse, SSLCertificate } from '../types';

// 設定後端地址
const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
});

// 修改 fetchDomains 增加 status 參數
export const fetchDomains = async (page = 1, limit = 10, sort = '', status = '') => {
    const response = await api.get<APIResponse<SSLCertificate[]>>('/domains', {
        params: { page, limit, sort, status } // 傳送給後端
    });
    return response.data;
};

export const syncDomains = async () => {
    return api.post('/domains/sync');
};

export const scanDomains = async () => {
    return api.post('/domains/scan');
};