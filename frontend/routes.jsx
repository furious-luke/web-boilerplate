import React from 'react';
import { Route, IndexRoute } from 'react-router';

import App from './components/app';
import MainView from './components/main-view';

export default (
  <Route path="/" component={ App }>
    <IndexRoute component={ MainView } />
  </Route>
);
