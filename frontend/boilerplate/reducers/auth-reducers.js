import { createReducer } from './utils';
import { login, logout } from '../actions/auth-actions';

const authReducer = createReducer( null, {

  AUTH_LOGIN( state, action ) {
    let { user, redirect, csrf_token } = action.payload || {};
    if( user === undefined )
      user = action.payload;
    return {
      ...state,
      user,
      redirect,
      csrf_token,
      loading: false
    };
  },

  AUTH_LOGIN_START( state, action ) {
    return {
      ...state,
      loading: true
    };
  },

  AUTH_LOGIN_ERROR( state, action ) {
    return {
      errors: action.payload,
      loading: false
    };
  },

  AUTH_LOGOUT( state, action ) {
    return null;
  }

});

export default authReducer;
