import { Box } from '@mui/material';
import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface RevenueData {
  date: string;
  deposits: string;
  withdrawals: string;
  bets: string;
  wins: string;
  netRevenue: string;
}

interface RevenueChartProps {
  data: RevenueData[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    deposits: parseFloat(item.deposits),
    withdrawals: parseFloat(item.withdrawals),
    netRevenue: parseFloat(item.netRevenue),
  }));

  return (
    <Box sx={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip
            formatter={(value: number) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(value)
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="deposits"
            stroke="#4caf50"
            strokeWidth={2}
            name="Deposits"
          />
          <Line
            type="monotone"
            dataKey="withdrawals"
            stroke="#f44336"
            strokeWidth={2}
            name="Withdrawals"
          />
          <Line
            type="monotone"
            dataKey="netRevenue"
            stroke="#2196f3"
            strokeWidth={2}
            name="Net Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;
