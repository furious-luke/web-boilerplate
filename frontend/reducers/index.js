import { combineReducers } from 'redux'
import { routerReducer as routing } from 'react-router-redux'

import { authReducer as auth } from '../boilerplate/reducers'

const rootReducer = combineReducers({
  auth,
  routing
});

export default rootReducer
