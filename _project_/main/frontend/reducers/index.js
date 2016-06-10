import { combineReducers } from 'redux'
import { routerReducer as routing } from 'react-router-redux'

import { dataReducer as data } from './data-reducers'
import { searchReducer as search } from './main-reducers'
import { authReducer as auth } from './auth-reducers'

const rootReducer = combineReducers({
  auth,
  data,
  search,
  routing
});

export default rootReducer
