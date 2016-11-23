import { combineReducers } from 'redux';
import { routerReducer as routing } from 'react-router-redux';
import { reducer as form } from 'redux-form';

import { authReducer as auth } from '../boilerplate/reducers';

console.log( 'YOO: ', auth );

const rootReducer = combineReducers({
  auth,
  routing,
  form
});

export default rootReducer;
