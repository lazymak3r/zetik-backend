import { selectors, slice, thunks } from './model';
export * from './config';
export * from './model/users.selectors';
export * from './model/users.slice';
export { default as usersReducer } from './model/users.slice';
export * from './model/users.thunks';

export default {
  actions: slice,
  thunks,
  selectors,
};
