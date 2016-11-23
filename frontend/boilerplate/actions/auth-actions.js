// import csrfSettings from '../libs/csrf';
// import $ from 'jquery';
// import { asyncAction } from 'redux-reusable';

import { createAction, postForm } from './utils';

const login = createAction( 'AUTH_LOGIN', (dispatch, getState, data) => {
  return postForm( '/login/', data )
    .then( response => {
      if( response.status == 200 ) {
        const { csrf_token } = response;
        if( csrf_token )
          csrfSettings.token = csrf_token;
        return dispatch({
          type: 'AUTH_LOGIN_SUCCESS',
          payload: response.json()
        });
      }
      else {
        dispatch({
          type: 'AUTH_LOGIN_ERROR',
          payload: response.json()
        });
      }
    });
});

const logout = createAction( 'AUTH_LOGOUT', (dispatch, getState) => {
  return postForm( '/logout/' )
    .then( () => {
      dispatch({
        type: 'AUTH_LOGOUT_SUCCESS'
      });
    });
});

export { login, logout };

/* function login( user, password ) {
   this.type = 'AUTH_LOGIN'
   return {
   type: 'AUTH_LOGIN',
   payload: {
   }

   export const authActions = {

   login: asyncAction(
   'LOGIN',
   ( dispatch, getState, success, failure, data ) => {

   ),

   logout: asyncAction(
   'LOGOUT',
   ( dispatch, getState, success, failure ) => {
   return $.post({ url: '/logout/', dataType: 'json' })
   .done( success )
   .fail( failure );
   }
   )
   }; */
