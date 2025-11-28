import { Delete, Search, Visibility } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CampaignDetailsDialog from '../components/dialogs/CampaignDetailsDialog';
import { useDebounce } from '../hooks/useDebounce';
import { AppDispatch, RootState } from '../store';
import {
  deleteCampaign,
  fetchCampaignDetails,
  fetchCampaigns,
} from '../store/slices/affiliateSlice';

const AffiliateCampaigns: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { campaigns, total, loading, selectedCampaign } = useSelector(
    (state: RootState) => state.affiliate,
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [ownerNameSearch, setOwnerNameSearch] = useState('');
  const [campaignCodeSearch, setCampaignCodeSearch] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const debouncedOwnerName = useDebounce(ownerNameSearch, 500);
  const debouncedCampaignCode = useDebounce(campaignCodeSearch, 500);

  useEffect(() => {
    loadCampaigns();
  }, [page, pageSize, debouncedOwnerName, debouncedCampaignCode]);

  const loadCampaigns = () => {
    void dispatch(
      fetchCampaigns({
        page: page + 1,
        limit: pageSize,
        ownerName: debouncedOwnerName || undefined,
        campaignCode: debouncedCampaignCode || undefined,
      }),
    );
  };

  const handleViewDetails = async (campaignId: string) => {
    await dispatch(fetchCampaignDetails(campaignId));
    setDetailsOpen(true);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      await dispatch(deleteCampaign(campaignId));
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'code',
      headerName: 'Code',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'owner',
      headerName: 'Owner',
      flex: 1,
      minWidth: 200,
      valueGetter: (params: any) => params?.email || params?.username || 'Unknown',
    },
    {
      field: 'uniqueReferrals',
      headerName: 'Referrals',
      width: 120,
      type: 'number',
    },
    {
      field: 'totalCommission',
      headerName: 'Total Commissions',
      width: 150,
      type: 'number',
      valueFormatter: (value: any) => (value == null ? '' : `$${value.toFixed(2)}`),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      valueFormatter: (value: any) => (value == null ? '' : new Date(value).toLocaleString()),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            color="primary"
            onClick={() => params.row?.id && handleViewDetails(params.row?.id)}
            size="small"
            title="View Details"
          >
            <Visibility />
          </IconButton>
          {params.row?.uniqueReferrals === 0 && (
            <IconButton
              color="error"
              onClick={() => params.row?.id && handleDeleteCampaign(params.row?.id)}
              size="small"
              title="Delete Campaign"
            >
              <Delete />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Affiliate Campaigns
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Search by Owner Name"
              variant="outlined"
              size="small"
              fullWidth
              value={ownerNameSearch}
              onChange={(e) => {
                setOwnerNameSearch(e.target.value);
                if (e.target.value) {
                  setCampaignCodeSearch('');
                }
              }}
              disabled={!!campaignCodeSearch}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Search by Campaign Code"
              variant="outlined"
              size="small"
              fullWidth
              value={campaignCodeSearch}
              onChange={(e) => {
                setCampaignCodeSearch(e.target.value);
                if (e.target.value) {
                  setOwnerNameSearch('');
                }
              }}
              disabled={!!ownerNameSearch}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataGrid
            rows={campaigns || []}
            columns={columns}
            rowCount={total}
            loading={loading}
            pageSizeOptions={[10, 20, 50, 100]}
            paginationMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            autoHeight
            disableRowSelectionOnClick
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      {selectedCampaign && (
        <CampaignDetailsDialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          campaign={selectedCampaign}
        />
      )}
    </Box>
  );
};

export default AffiliateCampaigns;
