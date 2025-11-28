import { configureStore } from '@reduxjs/toolkit';
import { paymentsReducer } from './payments';
import promocodesReducer from './promocodes/slice';
import affiliateReducer from './slices/affiliateSlice';
import authReducer from './slices/authSlice';
import blogReducer from './slices/blogSlice';
import bonusReducer from './slices/bonusSlice';
import dashboardReducer from './slices/dashboardSlice';
import transactionsReducer from './slices/transactionsSlice';
import vipTransfersReducer from './slices/vipTransfersSlice';
import slotsReducer from './slots/slice';
import st8BonusReducer from './st8Bonus/slice';
import { usersReducer } from './users';

export const store = configureStore({
  reducer: {
    affiliate: affiliateReducer,
    auth: authReducer,
    blog: blogReducer,
    dashboard: dashboardReducer,
    users: usersReducer,
    transactions: transactionsReducer,
    bonus: bonusReducer,
    payments: paymentsReducer,
    vipTransfers: vipTransfersReducer,
    promocodes: promocodesReducer,
    st8Bonus: st8BonusReducer,
    slots: slotsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
