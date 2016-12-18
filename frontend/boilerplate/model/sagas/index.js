import { takeLatest } from 'redux-saga';
import { call, apply, put, take, select } from 'redux-saga/effects';

import { makeId } from '../utils';
import DB from '../db';

function* loadModelView( action ) {
  try {
    const {schema, name, query, props} = action.payload;
    yield put( {type: 'MODEL_LOAD_VIEW_REQUEST', payload: {name}} );

    const state = yield select();
    let db = schema.db( state.model.db );
    let results = {};
    
    // Process each named query. We want to load the data, cache it
    // in results, then update the store immediately.
    for( const name of Object.keys( query ) ) {
      console.debug( `loadModelView: Looking up ${name}.` );
      const data = yield call( query[name], props );
      db.loadJsonApi( data );
      if( data ) {
        if( Array.isArray( data.data ) )
          results[name] = data.data.map( x => makeId( x.type, x.id ) );
        else
          results[name] = makeId( data.data.type, data.data.id );
      }
      else
        results[name] = null;
    }

    // Flag this view as ready. We also want to supply a list of IDs
    // of each type of model loaded.
    yield put( {type: 'MODEL_SET_DB', payload: db.data} );
    yield put( {type: 'MODEL_LOAD_VIEW_SUCCESS', payload: {name, results}} );
  }
  catch( e ) {
    console.error( e );
    yield put( {type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message} );
  }
}

function* sync( action ) {
  console.debug( 'Model: Sync.' );
  const schema = action.payload;
  try {
    yield put( {type: 'MODEL_SYNC_REQUEST'} );
    const state = yield select();
    let db = schema.db( state.model.db );
    while( true ) {
      const response = yield call( [db, db.commitDiff] );
      if( response === undefined )
        break;
      yield put( {type: 'MODEL_SET_DB', payload: db.data} );
    }
    yield put( {type: 'MODEL_SYNC_SUCCESS'} );
  }
  catch( e ) {
    console.error( e );
    yield put( {type: 'MODEL_SYNC_FAILURE', errors: e.message} );
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
    takeLatest( 'MODEL_LOAD_VIEW', loadModelView ),
    watchSync()
  ];
}
