import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { fetchUsers } from '../../../store/users/model/users.thunks';

export const useUsersData = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [bannedFilter, setBannedFilter] = useState<boolean | undefined>(undefined);

  const loadUsers = () => {
    void dispatch(
      fetchUsers({
        page: page + 1,
        limit: pageSize,
        search: searchTerm || undefined,
        isBanned: bannedFilter,
      }),
    );
  };

  useEffect(() => {
    loadUsers();
  }, [page, pageSize, searchTerm, bannedFilter]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    bannedFilter,
    setBannedFilter,
    loadUsers,
  };
};
