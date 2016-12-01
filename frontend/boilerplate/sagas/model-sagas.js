import { takeLatest } from 'redux-saga';
import { call, put } from 'redux-saga/effects';

import models from 'models';

/* function* fetchModels( action ) {
   try {
   const { model, id } = action.payload;
   //    const data = yield call( Api.fetchModels, model, id );
   data = {};
   yield put({ type: 'MODEL_LOAD_SUCCESS', data });
   }
   catch( e ) {
   yield put({ type: 'MODEL_LOAD_FAILURE', errors: e.message });
   }
   } */

function* fetchModelView( action ) {
  try {
    const { name, query, props } = action.payload;

    // Flag to the view that data is loading.
    yield put({ type: 'MODEL_LOAD_VIEW_REQUEST', payload: { name } });

    // Keep track of all the results of the lookups.
    let results = {};

    // Process each named query. We want to load the data, cache it
    // in results, then update the store immediately.
    for( const name of Object.keys( query ) ) {
      console.debug( `fetchModelView: Looking up ${name}.` );
      const data = yield call( query[name], props );
      results[name] = data;
      yield put({ type: 'MODEL_LOAD_SUCCESS', payload: data });
    }

    // Flag this view as ready. We also want to supply a list of IDs
    // of each type of model loaded.
    yield put({ type: 'MODEL_LOAD_VIEW_SUCCESS', payload: { name, results } });
  }
  catch( e ) {
    console.error( e );
    yield put({ type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message
    });
  }
}

function* sync( action ) {
  try {
    yield put({ type: 'MODEL_SYNC_REQUEST' });
    const db = new DB( yield select().model.db );
    for( const diff of db.calcOrderedDiffs() )
      yield call( db.syncDiff, diff );
    yield put({ type: 'MODEL_SYNC_SUCCESS', payload: diffs });
  }
  catch( e ) {
    console.error( e );
    yield put({ type: 'MODEL_SYNC_FAILURE', errors: e.message });
  }
}

export default function* modelSaga() {
  yield takeLatest( 'MODEL_LOAD_VIEW', fetchModelView );
}
