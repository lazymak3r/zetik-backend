import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  createPromocode,
  pausePromocode,
  resumePromocode,
  updatePromocode,
} from '../../store/promocodes/thunks';
import { ICreatePromocode, IUpdatePromocode } from '../../types/promocode.types';

export const usePromocodeTools = () => {
  const dispatch = useDispatch<AppDispatch>();

  return {
    createPromocode: (dto: ICreatePromocode) => dispatch(createPromocode(dto)),
    updatePromocode: (id: string, dto: IUpdatePromocode) => dispatch(updatePromocode({ id, dto })),
    pausePromocode: (id: string) => dispatch(pausePromocode(id)),
    resumePromocode: (id: string) => dispatch(resumePromocode(id)),
  };
};
