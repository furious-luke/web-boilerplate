import React from 'react'
import { Route, IndexRoute } from 'react-router'

import App from './boilerplate/components/app'
import MainPage from './components/main-page'

export default (
  <Route path="/" component={ App }>
    <IndexRoute component={ MainPage } />
  </Route>
)
