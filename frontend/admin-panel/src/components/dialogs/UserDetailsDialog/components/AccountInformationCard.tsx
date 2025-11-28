import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import React from 'react';
import { UserDetails } from '../../../../store/users/config/users.types';

interface AccountInformationCardProps {
  user: UserDetails;
}

const AccountInformationCard: React.FC<AccountInformationCardProps> = ({ user }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Account Information
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Email (wallet address / steam id)
          </Typography>
          <Typography variant="body1" gutterBottom>
            {user.email}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Username
          </Typography>
          <Typography variant="body1" gutterBottom>
            {user.username || 'Not set'}
          </Typography>

          <Typography variant="body2" color="textSecondary">
            User ID
          </Typography>
          <Typography
            variant="body1"
            gutterBottom
            sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
          >
            {user.id}
          </Typography>

          <Box display="flex" gap={1} mt={2}>
            <Chip
              label={user.isBanned ? 'Banned' : 'Active'}
              color={user.isBanned ? 'error' : 'success'}
              size="small"
            />
            <Chip
              label={user.isEmailVerified ? 'Verified' : 'Unverified'}
              color={user.isEmailVerified ? 'primary' : 'default'}
              size="small"
            />
          </Box>

          <Typography variant="body2" color="textSecondary" sx={{ mt: 3 }}>
            Cookie Consent
          </Typography>
          <Typography variant="body1" gutterBottom>
            {user.cookieConsentAcceptedAt
              ? `Accepted on ${new Date(user.cookieConsentAcceptedAt).toLocaleString()}`
              : 'Not accepted'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AccountInformationCard;
