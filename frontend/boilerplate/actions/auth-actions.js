import $ from 'jquery'
import { asyncAction } from 'redux-reusable'

const authActions = {

  login: asyncAction(
    'LOGIN',
    ( dispatch, getState, success, failure, data ) => {
      return $.post({ url: '/login/', data: data, dataType: 'json' })
              .done( success )
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
}

export default authActions
