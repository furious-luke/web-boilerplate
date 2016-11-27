import { createAction, postForm, csrfSettings } from './utils';

import api from 'api';

/**
 * Login over AJAX. Updates CSRF token.
 */
const login = createAction(
  'AUTH_LOGIN',
  (dispatch, getState, username, password) => {
    dispatch({ type: 'AUTH_LOGIN_START' });
    return api.login( username, password )
              .then( payload => {
                const { csrf_token } = payload;
                if( csrf_token )
                  csrfSettings.token = csrf_token;
                dispatch({
                  type: 'AUTH_LOGIN',
                  payload
                });
              })
              .catch( payload => {
                dispatch({
                  type: 'AUTH_LOGIN_ERROR',
                  payload
                });
              });
  }
);

/**
 * Logout over AJAX.
 */
const logout = createAction(
  'AUTH_LOGOUT',
  (dispatch, getState) => {
    return api.logout()
              .then( () => {
                dispatch({
                  type: 'AUTH_LOGOUT_SUCCESS'
                });
              });
  }
);

export { login, logout };
