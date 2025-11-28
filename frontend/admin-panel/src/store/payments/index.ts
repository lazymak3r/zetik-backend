import { selectors, slice, thunks } from './model';
export * from './config';
export * from './model/payments.selectors';
export * from './model/payments.slice';
export { default as paymentsReducer } from './model/payments.slice';
export * from './model/payments.thunks';

export default {
  actions: slice,
  thunks,
  selectors,
};
