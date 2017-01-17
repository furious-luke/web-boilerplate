import {call, put, take} from 'redux-saga/effects';
import {csrfSettings} from 'js-tinyapi';

import api from 'api';

export default function* authSaga() {
  while( true ) {
    try {
      const {payload: {username, password}} = yield take( 'AUTH_LOGIN' );
      console.debug( 'Auth: Logging on.' );
      
      yield put( {type: 'AUTH_LOGIN_REQUEST'} );

      const result = yield call( api.login, username, password );
      const {csrf_token} = result;
      if( csrf_token )
        csrfSettings.token = csrf_token;

      yield put( {type: 'AUTH_LOGIN_SUCCESS', payload: result} );
      console.debug( 'Auth: Logon succeeded.' );
    }
    catch( err ) {
      console.debug( 'Auth: Logon failed.' );
      console.error( err );
      yield put( {type: 'AUTH_LOGIN_FAILURE', errors: err} );
    }
  }
}
