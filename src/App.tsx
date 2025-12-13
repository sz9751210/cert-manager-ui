import React, { useState } from "react";
import {
  Switch,
  Select,
  Drawer,
  Input,
  Form,
  Layout,
  Menu,
  theme,
  Typography,
  Button,
  Space,
  message,
  Table,
  Tag,
  Tooltip,
  Card,
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
  testWebhook,
  saveSettings,
  getSettings,
} from "./services/api";
import type { SSLCertificate } from "./types";
import type { ColumnsType } from "antd/es/table";

dayjs.extend(relativeTime);
dayjs.locale("zh-tw");

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- 子組件：域名列表 (可重用) ---
const DomainListTable: React.FC<{
  filterStatus?: string;
  ignoredFilter: string;
}> = ({ filterStatus, ignoredFilter }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [onlyProxied, setOnlyProxied] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const queryClient = useQueryClient();

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
  ];

  return (
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
      </div>
      <Table
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
    </Card>
  );
};

// --- 子組件：設定抽屜 ---
const SettingsDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 載入設定
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    enabled: open, // 只有打開時才載入
  });

  // 填入表單
  React.useEffect(() => {
    if (settings) {
      form.setFieldsValue({ webhook_url: settings.webhook_url });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (values: { webhook_url: string }) =>
      saveSettings(values.webhook_url),
    onSuccess: () => {
      message.success("設定已儲存");
      onClose();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testWebhook(form.getFieldValue("webhook_url")),
    onSuccess: () => message.success("測試訊息已發送，請檢查您的通訊軟體"),
    onError: (err: any) =>
      message.error("測試失敗: " + err.response?.data?.error),
  });

  return (
    <Drawer
      title="系統設定"
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={(v) => saveMutation.mutate(v)}
      >
        <Form.Item
          label="Webhook URL (Slack/Discord/Teams)"
          name="webhook_url"
          extra="當憑證剩餘天數 < 14 天或發生異常時會發送通知。"
        >
          <Input placeholder="https://hooks.slack.com/services/..." />
        </Form.Item>

        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Button
            onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}
          >
            發送測試訊息
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saveMutation.isPending}
          >
            儲存設定
          </Button>
        </Space>
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
                />
              }
            />

            {/* 3. [新增] 已忽略：不限狀態, ignored=true */}
            <Route
              path="/ignored"
              element={<DomainListTable ignoredFilter="true" />}
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

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  );
};

export default App;
