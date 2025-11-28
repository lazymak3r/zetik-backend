import { Casino } from '@mui/icons-material';
import { Box, Card, CardContent, MenuItem, Select, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useCurrencyConversion } from '../../../../hooks/useCurrencyConversion';
import { UserDetails } from '../../../../store/users/config/users.types';

interface GamingStatisticsCardProps {
  gameStats: UserDetails['gameStats'] | null;
}

const GamingStatisticsCard: React.FC<GamingStatisticsCardProps> = ({ gameStats }) => {
  const { formatConvertedValue, availableCurrencies } = useCurrencyConversion();
  const [selectedAsset, setSelectedAsset] = useState<string>('USD');

  const { value, asset } = formatConvertedValue(gameStats?.averageBetSize, selectedAsset);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <Casino sx={{ verticalAlign: 'middle', mr: 1 }} />
          Gaming Statistics
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Total Games Played
          </Typography>
          <Typography variant="h5" gutterBottom>
            {gameStats?.totalGames || 0}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Favorite Game
          </Typography>
          <Typography variant="body1" gutterBottom>
            {gameStats?.favoriteGame || 'None'}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Win Rate
          </Typography>
          <Typography variant="body1" gutterBottom>
            {gameStats?.winRate || 0}%
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Average Bet Size
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {value} {asset}
            <Select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              label="Asset"
              style={{ marginLeft: 10 }}
            >
              <MenuItem value="USD">USD</MenuItem>
              {availableCurrencies.map((symbol) => (
                <MenuItem key={symbol} value={symbol}>
                  {symbol}
                </MenuItem>
              ))}
            </Select>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GamingStatisticsCard;
