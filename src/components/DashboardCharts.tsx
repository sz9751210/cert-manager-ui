// src/components/DashboardCharts.tsx
import React from "react";
import { Card, Col, Row, Statistic } from "antd";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { DashboardStats } from "../services/api";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
} from "@ant-design/icons";

// 顏色定義
const COLORS = {
  active: "#52c41a", // Green
  warning: "#faad14", // Orange
  expired: "#ff4d4f", // Red
  unresolvable: "#ffccc7", // Pale Red
  pending: "#1890ff", // Blue
};

interface Props {
  stats: DashboardStats | undefined;
  loading: boolean;
}

const DashboardCharts: React.FC<Props> = ({ stats, loading }) => {
  if (!stats) return null;

  // 1. 準備 Pie Chart 資料 (狀態分佈)
  const pieData = Object.keys(stats.status_counts).map((key) => ({
    name: key,
    value: stats.status_counts[key],
  }));

  // 2. 準備 Bar Chart 資料 (發行商 Top 5)
  const barData = Object.keys(stats.issuer_counts)
    .map((key) => ({ name: key, count: stats.issuer_counts[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // 只取前 5 名

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 第一排：關鍵指標卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="監控中域名總數"
              value={stats.total_domains}
              prefix={<SafetyCertificateOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="7天內過期"
              value={stats.expiry_counts["d7"] || 0}
              valueStyle={{ color: "#cf1322" }}
              prefix={<AlertOutlined />}
              loading={loading}
              suffix="個"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="30天內過期"
              value={stats.expiry_counts["d30"] || 0}
              valueStyle={{ color: "#faad14" }}
              prefix={<WarningOutlined />}
              loading={loading}
              suffix="個"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="無法解析/異常"
              value={stats.status_counts["unresolvable"] || 0}
              valueStyle={{ color: "#ff4d4f" }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 第二排：圖表 */}
      <Row gutter={16}>
        {/* 左邊：狀態分佈圓餅圖 */}
        <Col span={12}>
          <Card
            title="健康狀態分佈"
            bordered={false}
            style={{ minHeight: 300 }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    // @ts-ignore
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.name] || "#8884d8"}
                    />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 右邊：發行商長條圖 */}
        <Col span={12}>
          <Card
            title="SSL 發行商 Top 5"
            bordered={false}
            style={{ minHeight: 300 }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#1890ff" barSize={20} name="數量" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardCharts;
