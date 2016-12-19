// TODO: Put this somewhere else?
import { createReducer } from './utils';
import { login, logout } from '../actions/auth-actions';

const authReducer = createReducer( null, {

  AUTH_LOGIN_REQUEST( state, action ) {
    return {
      ...state,
      loading: true
    };
  },

  AUTH_LOGIN_SUCCESS( state, action ) {
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

  AUTH_LOGIN_FAILURE( state, action ) {
    return {
      errors: action.errors,
      loading: false
    };
  },

  AUTH_LOGOUT_REQUEST( state, action ) {
    return {
      ...state,
      loading: true
    };
  },

  AUTH_LOGOUT_SUCCESS( state, action ) {
    return null;
  },

  AUTH_LOGOUT_FAILURE( state, action ) {
    return {
      ...state,
      errors: action.errors,
      loading: false
    };
  }

});

export default authReducer;
