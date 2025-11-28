import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store';
import {
  fetchUserBalanceStatistics,
  selectUserBalanceStatistics,
} from '../../../../store/payments';
import { selectUserTransactionsData } from '../../../../store/users';
import { clearUserTransactions } from '../../../../store/users/model/users.slice';
import { fetchUserTransactions } from '../../../../store/users/model/users.thunks';

interface UseUserDetailsProps {
  open: boolean;
  userId: string | undefined;
}

export const useUserDetails = ({ open, userId }: UseUserDetailsProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const userBalanceStatistics = useSelector(selectUserBalanceStatistics);
  const {
    transactions: userTransactions,
    total: userTransactionsTotal,
    loading: userTransactionsLoading,
  } = useSelector(selectUserTransactionsData);

  const [transactionsPage, setTransactionsPage] = useState(0);
  const [transactionsPageSize, setTransactionsPageSize] = useState(10);

  useEffect(() => {
    if (open && userId) {
      void dispatch(fetchUserBalanceStatistics(userId));
    }
  }, [open, userId, dispatch]);

  useEffect(() => {
    if (!open || !userId) return;

    void dispatch(
      fetchUserTransactions({
        userId,
        page: transactionsPage,
        limit: transactionsPageSize,
      }),
    );
  }, [open, userId, transactionsPage, transactionsPageSize, dispatch]);

  useEffect(() => {
    if (!open) {
      dispatch(clearUserTransactions());
    }
  }, [open, dispatch]);

  const refreshTransactionsAndStatistics = useCallback(() => {
    if (!userId) return;

    void dispatch(fetchUserBalanceStatistics(userId));
    void dispatch(
      fetchUserTransactions({
        userId,
        page: transactionsPage,
        limit: transactionsPageSize,
      }),
    );
  }, [userId, transactionsPage, transactionsPageSize, dispatch]);

  return {
    userBalanceStatistics,
    userTransactions,
    userTransactionsTotal,
    userTransactionsLoading,
    transactionsPage,
    setTransactionsPage,
    transactionsPageSize,
    setTransactionsPageSize,
    refreshTransactionsAndStatistics,
  };
};
