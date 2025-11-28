import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { getUserAdminRole, searchUsers } from '../../../store/users/model/users.thunks';
import { User } from '../types/settings.types';

export const useUserSearch = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userCurrentRole, setUserCurrentRole] = useState<{
    role: string | null;
    userId: string;
  } | null>(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  const handleUserSearch = async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
      const results = await dispatch(searchUsers(query)).unwrap();
      setUserSearchResults(results);
    } catch (error) {
      console.error('Failed to search users:', error);
      setUserSearchResults([]);
    }
  };

  const handleUserSearchInputChange = (value: string) => {
    setUserSearchQuery(value);

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      void handleUserSearch(value);
    }, 400);

    setSearchDebounceTimer(timer);
  };

  const handleUserSelect = async (user: User | null) => {
    if (user) {
      try {
        const roleData = await dispatch(getUserAdminRole(user.id)).unwrap();
        setUserCurrentRole({ role: roleData.role, userId: user.id });
        return roleData.role;
      } catch (error) {
        console.error('Failed to get user role:', error);
        setUserCurrentRole({ role: null, userId: user.id });
        return null;
      }
    } else {
      setUserCurrentRole(null);
      return null;
    }
  };

  const resetUserSearch = () => {
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUserCurrentRole(null);
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      setSearchDebounceTimer(null);
    }
  };

  return {
    userSearchQuery,
    userSearchResults,
    userCurrentRole,
    handleUserSearchInputChange,
    handleUserSelect,
    resetUserSearch,
  };
};
