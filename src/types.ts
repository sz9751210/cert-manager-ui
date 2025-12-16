// src/types.ts

export interface SSLCertificate {
  id: string;
  domain_name: string;

  // Cloudflare
  cf_zone_id: string;
  cf_record_id: string;
  is_proxied: boolean; // 小橘雲

  // 設定
  is_ignored: boolean;
  auto_renew: boolean;

  // 狀態
  issuer: string;
  not_before: string; // ISO 日期字串
  not_after: string; // ISO 日期字串
  days_remaining: number;

  // 檢查結果
  last_check_time: string;
  status: "active" | "expired" | "warning" | "unresolvable" | "pending";
  error_msg?: string;
  sans?: string[];

  tls_version: string; // [新增]
  http_status_code: number; // [新增]
  latency: number; // [新增]
  domain_expiry_date: string; // ISO String
  domain_days_left: number;
}

export interface APIResponse<T> {
  data: T;
  total: number;
  page: number;
  limit: number;
}
