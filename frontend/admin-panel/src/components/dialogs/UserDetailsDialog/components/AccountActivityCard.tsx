import { Box, Card, CardContent, Typography } from '@mui/material';
import React from 'react';
import { UserDetails } from '../../../../store/users/config/users.types';

interface AccountActivityCardProps {
  user: UserDetails;
}

const AccountActivityCard: React.FC<AccountActivityCardProps> = ({ user }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Account Activity
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Account Created
          </Typography>
          <Typography variant="body1" gutterBottom>
            {new Date(user.createdAt).toLocaleString()}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Last Updated
          </Typography>
          <Typography variant="body1" gutterBottom>
            {new Date(user.updatedAt).toLocaleString()}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Last Login
          </Typography>
          <Typography variant="body1">
            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AccountActivityCard;
