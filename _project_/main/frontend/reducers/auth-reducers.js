import authActions from '../actions/auth-actions'
import { createReducer, asyncHandler } from 'redux-reusable'

const userReducer = createReducer(
  {
    [authActions.login.types.SUCCESS]( state, action ) {
      let { user, redirect, csrf_token } = action.results || {};
      if( user === undefined )
        user = action.results;
      return {
        ...state,
        user,
        redirect,
        csrf_token
      };
    }
  }
);

export const authReducer = createReducer([
  asyncHandler( 'auth', authActions.login.types, userReducer ),
  asyncHandler( 'auth', authActions.logout.types )
]);
