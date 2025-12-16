import React, { useState } from "react";
import {
  Alert,
  Switch,
  Select,
  Card,
  Drawer,
  Descriptions,
  Input,
  Form,
  Tabs,
  Layout,
  List,
  Menu,
  theme,
  Typography,
  Button,
  Space,
  message,
  Table,
  Tag,
  Tooltip,
} from "antd";
import {
  DashboardOutlined,
  DisconnectOutlined,
  SafetyCertificateOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloudServerOutlined,
  StopOutlined,
  SettingOutlined,
  DownloadOutlined,
  ClearOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-tw";
import {
  fetchDomains,
  scanDomains,
  syncDomains,
  fetchZones,
  updateDomainSettings,
  testNotification,
  saveSettings,
  getSettings,
  fetchStats,
  saveAcmeEmail,
  renewCert,
  batchUpdateSettings,
  exportDomainsCSV,
} from "./services/api";
import DashboardCharts from "./components/DashboardCharts";
import type { SSLCertificate } from "./types";
import type { ColumnsType } from "antd/es/table";
import Login from "./pages/Login"; // 引入登入頁

dayjs.extend(relativeTime);
dayjs.locale("zh-tw");

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- 子組件：域名列表 (可重用) ---
const DomainListTable: React.FC<{
  filterStatus?: string;
  ignoredFilter: string;
  showCharts?: boolean; // [新增] 控制是否顯示圖表
}> = ({ filterStatus, ignoredFilter, showCharts }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [onlyProxied, setOnlyProxied] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]); // [新增] 存被勾選的 ID
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SSLCertificate | null>(
    null
  );
  const queryClient = useQueryClient();
  // [新增] 控制詳情 Drawer 的 state
  // 1. 獲取主域名列表 (用於下拉選單)
  const { data: zones } = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });

  // 根據傳入的 filterStatus 向後端請求不同資料
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "domains",
      page,
      pageSize,
      filterStatus,
      onlyProxied,
      selectedZone,
      ignoredFilter,
    ],
    queryFn: () =>
      fetchDomains(
        page,
        pageSize,
        "expiry_asc",
        filterStatus || "",
        onlyProxied ? "true" : "",
        ignoredFilter,
        selectedZone || ""
      ),
    refetchInterval: 5000,
  });

  // 2. [新增] 切換忽略狀態的 Mutation
  const toggleIgnoreMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      updateDomainSettings(id, val),
    onSuccess: () => {
      message.success("設定已更新");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: () => message.error("更新失敗"),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    enabled: !!showCharts, // 只有 showCharts=true 才去抓
    refetchInterval: 10000,
  });

  const renewMutation = useMutation({
    mutationFn: (domain: string) => renewCert(domain),
    onSuccess: () =>
      message.success("續簽任務已在背景啟動，請稍後查看 Log 或重新掃描"),
  });

  // 批量 Mutation
  const batchMutation = useMutation({
    mutationFn: ({ ids, val }: { ids: string[]; val: boolean }) =>
      batchUpdateSettings(ids, val),
    onSuccess: () => {
      message.success("批量操作成功");
      setSelectedRowKeys([]); // 清空勾選
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  // 處理勾選變更
  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  const columns: ColumnsType<SSLCertificate> = [
    {
      title: "狀態",
      dataIndex: "status",
      width: 110,
      render: (status: string, record) => {
        if (record.is_ignored) return <Tag icon={<StopOutlined />}>已忽略</Tag>;
        let color = "default";
        let text = status;
        let icon = <CheckCircleOutlined />;

        if (status === "active") {
          color = "success";
          text = "正常";
        }
        if (status === "warning") {
          color = "warning";
          text = "即將過期";
          icon = <WarningOutlined />;
        }
        if (status === "expired") {
          color = "error";
          text = "已過期";
          icon = <WarningOutlined />;
        }
        if (status === "unresolvable") {
          color = "red";
          text = "無法解析";
          icon = <DisconnectOutlined />;
        }
        if (status === "pending") {
          color = "processing";
          text = "等待中";
          icon = <ReloadOutlined spin />;
        }

        return (
          <Tag icon={icon} color={color}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: "域名",
      dataIndex: "domain_name",
      render: (text: string, record) => (
        <Space>
          <span
            style={{
              fontWeight: 600,
              color: record.is_ignored ? "#999" : "inherit",
            }}
          >
            {text}
          </span>
          {record.is_proxied && (
            <Tooltip title="Proxy ON">
              <CloudServerOutlined style={{ color: "#fa8c16" }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "發行商", // [新增]
      dataIndex: "issuer",
      responsive: ["md"], // 在手機版隱藏，避免太擁擠
      render: (text: string) => text || "-",
    },
    // [新增] HTTP 狀態欄位
    {
      title: "HTTP",
      dataIndex: "http_status_code",
      width: 100,
      render: (code: number, record) => {
        if (record.is_ignored) return <span style={{ color: "#ccc" }}>-</span>;

        // 根據狀態碼顯示不同顏色的 Tag
        if (!code || code === 0) {
          return <Tag color="red">Down</Tag>;
        }
        if (code >= 200 && code < 300) {
          return (
            <Tooltip title={`回應時間: ${record.latency}ms`}>
              <Tag color="success">{code}</Tag>
            </Tooltip>
          );
        }
        if (code >= 300 && code < 400) {
          return <Tag color="blue">{code}</Tag>; // Redirect
        }
        if (code >= 400 && code < 500) {
          return <Tag color="orange">{code}</Tag>; // 404 Not Found
        }
        if (code >= 500) {
          return <Tag color="error">{code}</Tag>; // 500 Server Error
        }
        return <Tag>{code}</Tag>;
      },
    },

    // [新增] TLS 版本欄位
    {
      title: "TLS",
      dataIndex: "tls_version",
      width: 100,
      responsive: ["lg"], // 寬螢幕才顯示
      render: (ver: string, record) => {
        if (record.is_ignored || !ver) return "-";

        // TLS 1.0/1.1 標示為危險
        let color = "cyan"; // 預設安全 (1.2, 1.3)
        if (ver === "TLS 1.0" || ver === "TLS 1.1") {
          color = "volcano";
        }
        if (ver === "Unknown") {
          color = "default";
        }

        return <Tag color={color}>{ver}</Tag>;
      },
    },
    {
      title: "剩餘天數",
      dataIndex: "days_remaining",
      render: (days: number, record) => {
        if (record.is_ignored) return <span style={{ color: "#999" }}>-</span>; // 忽略的不顯示天數
        if (record.status === "unresolvable" || record.status === "pending")
          return <span style={{ color: "#ccc" }}>-</span>;
        let color = "green";
        if (days < 30) color = "orange";
        if (days < 7) color = "red";
        return <span style={{ color, fontWeight: "bold" }}>{days} 天</span>;
      },
    },
    {
      title: "上次檢查", // [新增]
      dataIndex: "last_check_time",
      width: 120,
      render: (date: string) => {
        // 使用 YYYY-MM-DD 格式，不顯示小時分鐘
        return date ? dayjs(date).format("YYYY-MM-DD") : "-";
      },
    },
    {
      title: "過期日期",
      dataIndex: "not_after",
      render: (date: string) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
      responsive: ["md"],
    },
    {
      title: "錯誤訊息",
      dataIndex: "error_msg",
      render: (msg: string) =>
        msg ? (
          <Typography.Text type="danger" style={{ fontSize: "12px" }}>
            {msg}
          </Typography.Text>
        ) : (
          "-"
        ),
      // 只有在顯示無法解析的列表時，錯誤訊息比較重要，這裡設為永遠顯示，但只在有值時出現
      responsive: ["lg"],
    },
    // [新增] 操作欄位：是否檢查
    {
      title: "監控中",
      dataIndex: "is_ignored",
      width: 100,
      render: (ignored: boolean, record) => (
        <Tooltip
          title={ignored ? "點擊開啟監控" : "點擊忽略檢查 (內網/測試域名)"}
        >
          <Switch
            checked={!ignored} // 這裡邏輯反過來：is_ignored=true 代表 checked=false (不監控)
            checkedChildren="開啟"
            unCheckedChildren="略過"
            onChange={(checked) => {
              toggleIgnoreMutation.mutate({ id: record.id, val: !checked });
            }}
            loading={toggleIgnoreMutation.isPending}
          />
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<InfoCircleOutlined />}
            onClick={() => {
              setCurrentRecord(record);
              setDetailDrawerOpen(true);
            }}
          >
            詳情
          </Button>
          <Button
            size="small"
            type="link"
            disabled={record.status === "unresolvable" || record.is_ignored}
            onClick={() => {
              if (confirm(`確定要為 ${record.domain_name} 申請新憑證嗎？`)) {
                renewMutation.mutate(record.domain_name);
              }
            }}
          >
            續簽 SSL
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {" "}
      {/* 包一層 div */}
      {/* [新增] 顯示圖表 */}
      {showCharts && <DashboardCharts stats={stats} loading={statsLoading} />}
      <Card bordered={false} style={{ borderRadius: "8px" }}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 16,
            alignItems: "center",
            padding: "12px",
            background: "#fafafa",
            borderRadius: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ marginRight: 8, fontWeight: 500 }}>主域名:</span>
            <Select
              style={{ width: 200 }}
              placeholder="選擇主域名 (All)"
              allowClear
              showSearch
              onChange={(value) => {
                setSelectedZone(value);
                setPage(1);
              }}
              options={zones?.map((z) => ({ label: z, value: z }))}
            />
          </div>
          <div
            style={{
              width: 1,
              height: 24,
              background: "#e0e0e0",
              margin: "0 8px",
            }}
          ></div>
          <Space>
            <span>只顯示 Proxy (橘雲):</span>
            <Switch checked={onlyProxied} onChange={setOnlyProxied} />
          </Space>
          {/* 右側：功能按鈕 (匯出) */}
          <Button icon={<DownloadOutlined />} onClick={exportDomainsCSV}>
            匯出報表
          </Button>
        </div>
        {/* [新增] 批量操作提示條 */}
        {hasSelected && (
          <div
            style={{
              marginBottom: 16,
              padding: "8px 16px",
              background: "#e6f7ff",
              border: "1px solid #91d5ff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>已選擇 {selectedRowKeys.length} 個項目</span>
            <Space>
              <Button
                size="small"
                icon={<EyeInvisibleOutlined />}
                onClick={() =>
                  batchMutation.mutate({
                    ids: selectedRowKeys as string[],
                    val: true,
                  })
                } // val: true 代表設為忽略
                loading={batchMutation.isPending}
              >
                批量略過
              </Button>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() =>
                  batchMutation.mutate({
                    ids: selectedRowKeys as string[],
                    val: false,
                  })
                } // val: false 代表開啟監控
                loading={batchMutation.isPending}
              >
                批量開啟監控
              </Button>
              <Button
                size="small"
                type="text"
                onClick={() => setSelectedRowKeys([])}
              >
                取消
              </Button>
            </Space>
          </div>
        )}
        <Table
          rowSelection={rowSelection} // [新增] 開啟勾選功能
          columns={columns}
          dataSource={data?.data}
          rowKey="id"
          loading={isLoading || isFetching}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: data?.total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        {/* [新增] 詳情 Drawer */}
        <Drawer
          title="憑證詳細資訊"
          placement="right"
          width={500}
          onClose={() => setDetailDrawerOpen(false)}
          open={detailDrawerOpen}
        >
          {currentRecord && (
            <>
              <Descriptions title="基本資訊" column={1} bordered size="small">
                <Descriptions.Item label="域名">
                  {currentRecord.domain_name}
                </Descriptions.Item>
                <Descriptions.Item label="發行商">
                  {currentRecord.issuer}
                </Descriptions.Item>
                <Descriptions.Item label="生效日">
                  {dayjs(currentRecord.not_before).format("YYYY-MM-DD HH:mm")}
                </Descriptions.Item>
                <Descriptions.Item label="到期日">
                  {dayjs(currentRecord.not_after).format("YYYY-MM-DD HH:mm")}
                </Descriptions.Item>
                <Descriptions.Item label="Cloudflare Proxy">
                  {currentRecord.is_proxied ? "開啟 (CDN)" : "關閉 (直連)"}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 24 }}>
                <h4>包含的域名 (SANs)</h4>
                <List
                  size="small"
                  bordered
                  dataSource={currentRecord.sans || []}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                  style={{ maxHeight: 300, overflowY: "auto" }}
                />
              </div>
            </>
          )}
        </Drawer>
      </Card>
    </div>
  );
};

// --- 子組件：設定抽屜 ---
const SettingsDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [form] = Form.useForm();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    enabled: open,
  });

  React.useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings);
    } else {
      // 預設值
      form.setFieldsValue({ webhook_enabled: false, telegram_enabled: false });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (values: any) => saveSettings(values),
    onSuccess: () => {
      message.success("設定已儲存");
      onClose();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testNotification(form.getFieldsValue()), // 傳送當前表單所有值
    onSuccess: () => message.success("測試訊息已發送"),
    onError: (err: any) =>
      message.error("測試失敗: " + (err.response?.data?.error || "未知錯誤")),
  });

  const saveAcmeMutation = useMutation({
    mutationFn: (email: string) => saveAcmeEmail(email),
    onSuccess: () => message.success("Email 已儲存"),
  });

  return (
    <Drawer
      title="通知設定"
      placement="right"
      onClose={onClose}
      open={open}
      width={480}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={(v) => saveMutation.mutate(v)}
      >
        <Alert
          message="請至少啟用一種通知方式以接收告警。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs
          defaultActiveKey="webhook"
          items={[
            {
              key: "webhook",
              label: "Webhook",
              children: (
                <div style={{ marginTop: 12 }}>
                  <Form.Item
                    name="webhook_enabled"
                    label="啟用 Webhook"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, curr) =>
                      prev.webhook_enabled !== curr.webhook_enabled
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue("webhook_enabled") && (
                        <Form.Item
                          label="URL (Slack/Discord/Teams)"
                          name="webhook_url"
                          rules={[
                            { required: true, message: "請輸入 Webhook URL" },
                          ]}
                        >
                          <Input placeholder="https://hooks.slack.com/..." />
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                </div>
              ),
            },
            {
              key: "telegram",
              label: "Telegram",
              children: (
                <div style={{ marginTop: 12 }}>
                  <Form.Item
                    name="telegram_enabled"
                    label="啟用 Telegram"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, curr) =>
                      prev.telegram_enabled !== curr.telegram_enabled
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue("telegram_enabled") && (
                        <>
                          <Form.Item
                            label="Bot Token"
                            name="telegram_bot_token"
                            rules={[
                              { required: true, message: "請輸入 Bot Token" },
                            ]}
                            help={
                              <a
                                href="https://t.me/BotFather"
                                target="_blank"
                                rel="noreferrer"
                              >
                                向 @BotFather 申請
                              </a>
                            }
                          >
                            <Input placeholder="123456789:ABCdef..." />
                          </Form.Item>
                          <Form.Item
                            label="Chat ID"
                            name="telegram_chat_id"
                            rules={[
                              { required: true, message: "請輸入 Chat ID" },
                            ]}
                            help="可以是個人 ID 或群組 ID (需先將 Bot 加入群組)"
                          >
                            <Input placeholder="-987654321" />
                          </Form.Item>
                        </>
                      )
                    }
                  </Form.Item>
                </div>
              ),
            },
            {
              key: "acme",
              label: "SSL 續簽",
              children: (
                <div style={{ marginTop: 12 }}>
                  <Alert
                    message="Let's Encrypt 整合"
                    description="設定 Email 後，系統將自動註冊帳號。之後您可對過期域名執行自動續簽 (DNS-01 驗證)。"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Form.Item
                    label="註冊 Email"
                    name="acme_email"
                    rules={[{ type: "email", message: "格式不正確" }]}
                  >
                    <Input placeholder="admin@example.com" />
                  </Form.Item>
                  <Button
                    onClick={() =>
                      saveAcmeMutation.mutate(form.getFieldValue("acme_email"))
                    }
                    loading={saveAcmeMutation.isPending}
                  >
                    儲存 Email
                  </Button>
                </div>
              ),
            },
          ]}
        />

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Button
            onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}
          >
            發送測試
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saveMutation.isPending}
          >
            儲存設定
          </Button>
        </div>
      </Form>
    </Drawer>
  );
};
// --- 主 Layout ---
const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 操作按鈕邏輯
  const syncMutation = useMutation({
    mutationFn: syncDomains,
    onSuccess: () => {
      message.success("同步請求已發送");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: () => message.error("同步失敗"),
  });

  const scanMutation = useMutation({
    mutationFn: scanDomains,
    onSuccess: () => message.success("背景掃描已啟動"),
  });

  // 動態標題
  let pageTitle = "監控儀表板";
  if (location.pathname === "/unresolvable") pageTitle = "DNS 解析異常列表";
  if (location.pathname === "/ignored") pageTitle = "已停止監控列表";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} style={{ background: "#001529" }}>
        <div
          style={{
            height: "64px",
            margin: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SafetyCertificateOutlined
            style={{ fontSize: "24px", color: "#1890ff", marginRight: "8px" }}
          />
          <span
            style={{ color: "white", fontSize: "18px", fontWeight: "bold" }}
          >
            CertManager
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            {
              key: "/",
              icon: <DashboardOutlined />,
              label: <Link to="/">監控儀表板</Link>,
            },
            {
              key: "/unresolvable",
              icon: <DisconnectOutlined />,
              label: <Link to="/unresolvable">無法解析域名</Link>,
            },
            // [新增] 側邊欄選項
            {
              key: "/ignored",
              icon: <StopOutlined />,
              label: <Link to="/ignored">已停止監控</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {pageTitle}
          </Title>
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsOpen(true)}
            >
              設定
            </Button>
            <Button
              icon={<CloudSyncOutlined />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
            >
              同步 CF
            </Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => scanMutation.mutate()}
              loading={scanMutation.isPending}
            >
              重新掃描
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: "24px 16px", padding: 24, minHeight: 280 }}>
          <Routes>
            {/* 1. 首頁：active_only, ignored=false */}
            <Route
              path="/"
              element={
                <DomainListTable
                  filterStatus="active_only"
                  ignoredFilter="false"
                  showCharts={true}
                />
              }
            />

            {/* 2. 無法解析：unresolvable, ignored=false */}
            <Route
              path="/unresolvable"
              element={
                <DomainListTable
                  filterStatus="unresolvable"
                  ignoredFilter="false"
                  showCharts={false}
                />
              }
            />

            {/* 3. [新增] 已忽略：不限狀態, ignored=true */}
            <Route
              path="/ignored"
              element={
                <DomainListTable ignoredFilter="true" showCharts={false} />
              }
            />
          </Routes>
        </Content>
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </Layout>
    </Layout>
  );
};

// 保護路由組件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");
  if (!token) {
    // 沒有 Token，重定向到登入頁
    // 這裡用 window.location 簡單處理，或是用 Navigate 組件
    window.location.href = "/login";
    return null;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* 所有其他路徑都包在 MainLayout 內，並受保護 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
