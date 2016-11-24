import { takeLatest } from 'redux-saga';
import { call, put } from 'redux-saga/effects';

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
    Object.keys( query ).forEach( function*( name ) {
      const info = query[name];
      const { model } = info;
      const [ type, id ] = model.split( ':' );

      // Load the data.
//      const data = yield call( Api.fetchModels, type, id );
      const data = {};

      // Then update the store.
      // TODO: We really don't want to do it this way in the long.
      //   run. I think we'll want to combine the loads into one.
      yield put({ type: 'MODEL_LOAD_SUCCESS', payload: { data }});
    });

    // Flag this view as ready.
    yield put({ type: 'MODEL_LOAD_VIEW_SUCCESS', payload: { name }});
  }
  catch( e ) {
    yield put({ type: 'MODEL_LOAD_FAILURE', errors: e.message });
    yield put({ type: 'MODEL_LOAD_VIEW_FAILURE', errors: e.message });
  }
}

export default function* modelSaga() {
  yield takeLatest( 'MODEL_LOAD_VIEW', fetchModelView );
}
