import csrfSettings from '../libs/csrf';
import $ from 'jquery';
import { asyncAction } from 'redux-reusable';

export const authActions = {

  login: asyncAction(
    'LOGIN',
    ( dispatch, getState, success, failure, data ) => {
      return $.post({ url: '/login/', data: data, dataType: 'json' })
              .done( response => {
                const { csrf_token } = response;
                if( csrf_token )
                  csrfSettings.token = csrf_token;
                return success( response );
              })
              .fail( failure );
    }
  ),

  logout: asyncAction(
    'LOGOUT',
    ( dispatch, getState, success, failure ) => {
      return $.post({ url: '/logout/', dataType: 'json' })
              .done( success )
              .fail( failure );
    }
  )
};
