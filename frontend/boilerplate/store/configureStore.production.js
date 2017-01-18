import { createStore, applyMiddleware } from 'redux';
import { browserHistory } from 'react-router';
import { routerMiddleware } from 'react-router-redux';
import {enableBatching} from 'redux-batched-actions';
import createSagaMiddleware from 'redux-saga';

import rootReducer from 'reducers';
import rootSaga from 'sagas';

const sagaMiddleware = createSagaMiddleware();
const enhancer = applyMiddleware( sagaMiddleware, routerMiddleware( browserHistory ) );

export default function configureStore( initialState ) {
  let finalReducer;
  if( enableBatching )
    finalReducer = enableBatching( rootReducer );
  else
    finalReducer = rootReducer;
  const store = createStore( finalReducer, initialState, enhancer );
  sagaMiddleware.run( rootSaga );
  return store;
}
