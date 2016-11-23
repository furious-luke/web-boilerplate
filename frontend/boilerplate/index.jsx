// Bootstrap CSS comes first so that we can override
// it with other things.
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.min.css';

import './libs/csrf';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';

import routes from 'routes';
import configureStore from './store';

import 'bootstrap/dist/js/bootstrap.min';

const store = configureStore({
  auth: {
    user: jsdata( 'user' )
  }
});

const history = syncHistoryWithStore( browserHistory, store );

render(
  <Provider store={ store }>
    <Router history={ history }>
      { routes }
    </Router>
  </Provider>,
  document.getElementById( 'main-mount' )
);

if( process.env.NODE_ENV !== 'production' ) {
  if( module.hot )
    module.hot.accept();
}
