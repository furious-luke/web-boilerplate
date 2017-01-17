import {createStore, applyMiddleware, compose} from 'redux';
import {persistState} from 'redux-devtools';
import {browserHistory} from 'react-router';
import {routerMiddleware} from 'react-router-redux';
import {enableBatching} from 'redux-batched-actions';
import createSagaMiddleware from 'redux-saga';

import rootReducer from 'reducers';
import rootSaga from 'sagas';
import DevTools from '../components/dev-tools';

const sagaMiddleware = createSagaMiddleware();
const enhancer = compose(
  applyMiddleware( sagaMiddleware, routerMiddleware( browserHistory ) ),
  DevTools.instrument(),
  persistState(
    window.location.href.match(
      /[?&]debug_session=([^&]+)\b/
    )
  )
);

export default function configureStore( initialState ) {
  let finalReducer;
  if( enableBatching )
    finalReducer = enableBatching( rootReducer );
  else
    finalReducer = rootReducer;
  const store = createStore( finalReducer, initialState, enhancer );

  /* router.listenForReplays( store ); */

  if( module.hot ) {
    module.hot.accept( 'reducers', () =>
      store.replaceReducer( require( 'reducers' ) )
    );
  }

  // Launch the saga.
  sagaMiddleware.run( rootSaga );

  return store;
}
