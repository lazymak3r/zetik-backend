import {
  AccountBalance,
  AccountCircle,
  Article,
  BugReport,
  CardGiftcard,
  Casino,
  Dashboard,
  ExitToApp,
  Image,
  Link,
  LocalOffer,
  Menu as MenuIcon,
  Payment,
  People,
  Redeem,
  Settings,
  SportsEsports,
  SwapHoriz,
} from '@mui/icons-material';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { logout, logoutServer } from '../../store/slices/authSlice';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/' },
  { text: 'Users', icon: <People />, path: '/users' },
  { text: 'Avatars', icon: <Image />, path: '/avatars' },
  { text: 'Transactions', icon: <AccountBalance />, path: '/transactions' },
  { text: 'Payments', icon: <Payment />, path: '/payments' },
  { text: 'Games', icon: <SportsEsports />, path: '/games' },
  { text: 'Slots Management', icon: <Casino />, path: '/slots-management' },
  { text: 'Bonus', icon: <CardGiftcard />, path: '/bonus' },
  { text: 'ST8 Bonuses', icon: <Redeem />, path: '/st8-bonuses' },
  { text: 'VIP Transfers', icon: <SwapHoriz />, path: '/vip-transfers' },
  { text: 'Blog', icon: <Article />, path: '/blog' },
  { text: 'Affiliate', icon: <Link />, path: '/affiliate' },
  { text: 'Testing', icon: <BugReport />, path: '/testing/self-exclusion' },
  { text: 'Promocodes', icon: <LocalOffer />, path: '/promocodes' },
  { text: 'Settings', icon: <Settings />, path: '/settings' },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { admin } = useSelector((state: RootState) => state.auth);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    void navigate('/profile');
  };

  const handleLogout = () => {
    void (async () => {
      try {
        // Try server logout first to invalidate tokens
        await dispatch(logoutServer()).unwrap();
      } catch (error) {
        // If server logout fails, still proceed with local logout
        console.warn('Server logout failed:', error);
      } finally {
        // Always clear local state and navigate
        void dispatch(logout());
        void navigate('/login');
      }
    })();
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap>
          Zetik Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                void navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find((item) => item.path === location.pathname)?.text || 'Admin Panel'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {admin?.name}
            </Typography>
            <IconButton onClick={handleMenuClick} color="inherit">
              <AccountCircle />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem onClick={handleProfileClick}>
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <ExitToApp fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
