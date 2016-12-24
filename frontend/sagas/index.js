import {take, put, select, call} from 'redux-saga/effects';

import {saga as modelSaga} from 'redux-jam';
import {authSaga} from 'boilerplate/sagas';

function *eachInline( actionType, saga ) {
  while( true ) {
    const action = yield take( actionType );
    yield saga( action.payload );
  }
}

function *rootSaga() {
  yield [
    authSaga(),
    modelSaga(),
  ];
}

export default rootSaga;
