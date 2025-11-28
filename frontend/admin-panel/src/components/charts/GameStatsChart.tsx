import { Box } from '@mui/material';
import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface GameStats {
  gameType: string;
  gamesPlayed: number;
  totalBets: string;
  totalWins: string;
  houseEdgePercent: number;
}

interface GameStatsChartProps {
  data: GameStats[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const GameStatsChart: React.FC<GameStatsChartProps> = ({ data }) => {
  const chartData = Array.isArray(data)
    ? data.map((game) => ({
        name: game.gameType,
        value: game.gamesPlayed,
        bets: parseFloat(game.totalBets),
        houseEdge: game.houseEdgePercent,
      }))
    : [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'white',
            p: 1,
            border: '1px solid #ccc',
            borderRadius: 1,
          }}
        >
          <p style={{ margin: 0 }}>{`${data.name}: ${data.value} games`}</p>
          <p style={{ margin: 0 }}>{`Bets: $${data.bets.toFixed(2)}`}</p>
          <p style={{ margin: 0 }}>{`House Edge: ${data.houseEdge}%`}</p>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default GameStatsChart;
