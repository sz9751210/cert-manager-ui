import React, { useState } from 'react';
import { 
  Layout, Menu, theme, Typography, Button, Space, message, Table, Tag, Tooltip, Card 
} from 'antd';
import { 
  DashboardOutlined, 
  DisconnectOutlined, 
  SafetyCertificateOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloudServerOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-tw';
import { fetchDomains, scanDomains, syncDomains } from './services/api';
import type { SSLCertificate } from './types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);
dayjs.locale('zh-tw');

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- 子組件：域名列表 (可重用) ---
const DomainListTable: React.FC<{ filterStatus: string }> = ({ filterStatus }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 根據傳入的 filterStatus 向後端請求不同資料
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['domains', page, pageSize, filterStatus],
    queryFn: () => fetchDomains(page, pageSize, 'expiry_asc', filterStatus),
    refetchInterval: 5000, 
  });

  const columns: ColumnsType<SSLCertificate> = [
    {
      title: '狀態',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => {
        let color = 'default';
        let text = status;
        let icon = <CheckCircleOutlined />;

        if (status === 'active') { color = 'success'; text = '正常'; }
        if (status === 'warning') { color = 'warning'; text = '即將過期'; icon = <WarningOutlined />; }
        if (status === 'expired') { color = 'error'; text = '已過期'; icon = <WarningOutlined />; }
        if (status === 'unresolvable') { color = 'red'; text = '無法解析'; icon = <DisconnectOutlined />; }
        if (status === 'pending') { color = 'processing'; text = '等待中'; icon = <ReloadOutlined spin />; }

        return <Tag icon={icon} color={color}>{text}</Tag>;
      },
    },
    {
      title: '域名',
      dataIndex: 'domain_name',
      render: (text: string, record) => (
        <Space>
          <span style={{ fontWeight: 600 }}>{text}</span>
          {record.is_proxied ? (
            <Tooltip title="Cloudflare Proxy 已開啟 (橘雲)">
              <CloudServerOutlined style={{ color: '#fa8c16' }} />
            </Tooltip>
          ) : (
             <Tooltip title="DNS Only (灰雲)">
              <CloudServerOutlined style={{ color: '#bfbfbf' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
        title: '剩餘天數',
        dataIndex: 'days_remaining',
        render: (days: number, record) => {
          if (record.status === 'unresolvable' || record.status === 'pending') return <span style={{color: '#ccc'}}>-</span>;
          let color = 'green';
          if (days < 30) color = 'orange';
          if (days < 7) color = 'red';
          return <span style={{ color, fontWeight: 'bold' }}>{days} 天</span>;
        },
    },
    {
        title: '過期日期',
        dataIndex: 'not_after',
        render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
        responsive: ['md'],
    },
    {
        title: '錯誤訊息',
        dataIndex: 'error_msg',
        render: (msg: string) => msg ? <Typography.Text type="danger" style={{fontSize: '12px'}}>{msg}</Typography.Text> : '-',
        // 只有在顯示無法解析的列表時，錯誤訊息比較重要，這裡設為永遠顯示，但只在有值時出現
        responsive: ['lg'],
    },
  ];

  return (
    <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <Table 
            columns={columns} 
            dataSource={data?.data} 
            rowKey="id"
            loading={isLoading || isFetching}
            pagination={{
                current: page,
                pageSize: pageSize,
                total: data?.total,
                onChange: (p, ps) => { setPage(p); setPageSize(ps); },
                showSizeChanger: true
            }}
        />
    </Card>
  );
};

// --- 主 Layout ---
const MainLayout: React.FC = () => {
    const {
        token: { colorBgContainer },
    } = theme.useToken();
    const location = useLocation();
    const queryClient = useQueryClient();

    // 操作按鈕邏輯
    const syncMutation = useMutation({
        mutationFn: syncDomains,
        onSuccess: () => {
          message.success('同步請求已發送');
          queryClient.invalidateQueries({ queryKey: ['domains'] });
        },
        onError: () => message.error('同步失敗'),
    });
    
    const scanMutation = useMutation({
        mutationFn: scanDomains,
        onSuccess: () => message.success('背景掃描已啟動'),
    });

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider width={220} style={{ background: '#001529' }}>
                <div style={{ height: '64px', margin: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SafetyCertificateOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '8px' }} />
                    <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>CertManager</span>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={[
                        {
                            key: '/',
                            icon: <DashboardOutlined />,
                            label: <Link to="/">監控儀表板</Link>,
                        },
                        {
                            key: '/unresolvable',
                            icon: <DisconnectOutlined />,
                            label: <Link to="/unresolvable">無法解析域名</Link>,
                        },
                    ]}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        {location.pathname === '/' ? '監控儀表板' : 'DNS 解析異常列表'}
                    </Title>
                    <Space>
                        <Button icon={<CloudSyncOutlined />} onClick={() => syncMutation.mutate()} loading={syncMutation.isPending}>
                            同步 CF
                        </Button>
                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => scanMutation.mutate()} loading={scanMutation.isPending}>
                            重新掃描
                        </Button>
                    </Space>
                </Header>
                <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
                    <Routes>
                        {/* 首頁：顯示 active_only (排除 unresolvable) */}
                        <Route path="/" element={<DomainListTable filterStatus="active_only" />} />
                        
                        {/* 無法解析頁：只顯示 unresolvable */}
                        <Route path="/unresolvable" element={<DomainListTable filterStatus="unresolvable" />} />
                    </Routes>
                </Content>
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