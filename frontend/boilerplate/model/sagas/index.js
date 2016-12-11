import { takeLatest } from 'redux-saga';
import { call, put, take } from 'redux-saga/effects';

import models from 'models';

function* fetchModelView( action ) {
  try {
    const {name, query, props} = action.payload;

    // Flag to the view that data is loading.
    yield put( {type: 'MODEL_LOAD_VIEW_REQUEST', payload: {name}} );

    // Keep track of all the results of the lookups.
    let results = {};

    // Process each named query. We want to load the data, cache it
    // in results, then update the store immediately.
    for( const name of Object.keys( query ) ) {
      console.debug( `fetchModelView: Looking up ${name}.` );
      const data = yield call( query[name], props );
      results[name] = data;
      yield put( {type: 'MODEL_LOAD_SUCCESS', payload: data} );
    }

    // Flag this view as ready. We also want to supply a list of IDs
    // of each type of model loaded.
    yield put( {type: 'MODEL_LOAD_VIEW_SUCCESS', payload: {name, results}} );
  }
  catch( e ) {
    console.error( e );
    yield put( {type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message} );
  }
}

function* sync( action ) {
  try {
    yield put({ type: 'MODEL_SYNC_REQUEST' });
    const db = new DB( yield select().model.db );
    while( true ) {
      const response = yield call( db.commitDiff );
      if( response === undefined )
        break;
      yield put({ type: 'MODEL_COMMIT_DIFF', payload: { diff, response  }});
    }
    yield put({ type: 'MODEL_SYNC_SUCCESS' });
  }
  catch( e ) {
    console.error( e );
    yield put({ type: 'MODEL_SYNC_FAILURE', errors: e.message });
  }
}

function* watchSync() {
  while( true ) {
    const action = yield take( 'MODEL_SYNC' );
    yield call( sync, action );
  }
}

export default function* modelSaga() {
  yield [
    takeLatest( 'MODEL_LOAD_VIEW', fetchModelView ),
    watchSync()
  ];
}
