import {combineReducers} from 'redux';
import {routerReducer as routing} from 'react-router-redux';
import {reducer as form} from 'redux-form';
import {reducer as model} from 'redux-jam';

import {authReducer as auth} from '../boilerplate/reducers';

const rootReducer = combineReducers({
  auth,
  routing,
  form,
  model
});

export default rootReducer;
