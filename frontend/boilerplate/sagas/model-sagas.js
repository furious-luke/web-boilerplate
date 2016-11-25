import { takeLatest } from 'redux-saga';
import { call, put } from 'redux-saga/effects';

import api from 'sagas/api';

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
    const { name, query } = action.payload;

    // Flag to the view that data is loading.
    yield put({ type: 'MODEL_LOAD_VIEW_REQUEST', payload: { name }});

    // Process each named query.
    for( const name of Object.keys( query ) ) {
      const { type, id } = query[name];

      // Load the data.
      const data = yield call( api.call['listDocuments'], id );

      // Then update the store.
      // TODO: We really don't want to do it this way in the long.
      //   run. I think we'll want to combine the loads into one.
      yield put({ type: 'MODEL_LOAD_SUCCESS', payload: data });
//    });
    }

    // Flag this view as ready.
    yield put({ type: 'MODEL_LOAD_VIEW_SUCCESS', payload: { name }});
  }
  catch( e ) {
    console.log( e );
    yield put({ type: 'MODEL_LOAD_FAILURE', errors: e.message });
    yield put({ type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message });
  }
}

export default function* modelSaga() {
  yield takeLatest( 'MODEL_LOAD_VIEW', fetchModelView );
}
