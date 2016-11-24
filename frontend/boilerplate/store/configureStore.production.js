import { createStore, applyMiddleware } from 'redux';
import { browserHistory } from 'react-router';
import { routerMiddleware } from 'react-router-redux';
import createSagaMiddleware from 'redux-saga';

import rootReducer from 'reducers';

const sagaMiddleware = createSagaMiddleware();
const enhancer = applyMiddleware( sagaMiddleware, routerMiddleware( browserHistory ) );

export default function configureStore( initialState ) {
  let store = createStore( rootReducer, initialState, enhancer );
  sagaMiddleware.run( rootSaga );
  return store;
}
