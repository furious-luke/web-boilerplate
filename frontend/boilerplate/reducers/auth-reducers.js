import { createReducer } from './utils';
import { login, logout } from '../actions/auth-actions';

const authReducer = createReducer( null, {

  [login]( state, action ) {
    let { user, redirect, csrf_token } = action.results || {};
    if( user === undefined )
      user = action.results;
    return {
      ...state,
      user,
      redirect,
      csrf_token
    };
  },

  [logout]( state, action ) {
    return null;
  },

  AUTH_LOGIN_ERROR( state, action ) {
    return {
      error: payload
    };
  }

});

export default authReducer;
