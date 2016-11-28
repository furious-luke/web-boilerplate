import { takeLatest } from 'redux-saga';
import { call, put } from 'redux-saga/effects';

import models from 'models';

function* fetchModels( action ) {
  try {
    const { model, id } = action.payload;
//    const data = yield call( Api.fetchModels, model, id );
    data = {};
    yield put({ type: 'MODEL_LOAD_SUCCESS', data });
  }
  catch( e ) {
    yield put({ type: 'MODEL_LOAD_FAILURE', errors: e.message });
  }
}

function* fetchModelView( action ) {
  try {
    const { name, query, props } = action.payload;

    // Flag to the view that data is loading.
    yield put({
      type: 'MODEL_LOAD_VIEW_REQUEST',
      payload: { name }
    });

    // Keep track of all the results of the lookups.
    let results = {};

    // Process each named query.
    for( const name of Object.keys( query ) ) {
      console.debug( `fetchModelView: Looking up ${name}.` );

      // Load the data.
      const [ data, included ] = yield call( query[name], props );
      results[name] = data;

      // Then update the store.
      yield put({
        type: 'MODEL_LOAD_SUCCESS',
        payload: [ ...((data instanceof Array) ? data : [ data ]), ...included ]
      });
    }

    // Flag this view as ready.
    yield put({
      type: 'MODEL_LOAD_VIEW_SUCCESS',
      payload: { name, results }
    });
  }
  catch( e ) {
    console.error( e );
    yield put({
      type: 'MODEL_LOAD_FAILURE',
      errors: e.message
    });
    yield put({
      type: 'MODEL_LOAD_VIEW_FAILURE',
      errors: e.message
    });
  }
}

function* saveModels( action ) {
  try {
    yield put({ type: 'MODEL_SYNC_REQUEST' });
    const diffs = yield call( schema.sync );
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
