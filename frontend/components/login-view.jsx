import React from 'react';
import {bindActionCreators} from 'redux';
import {connect } from 'react-redux';

import authActions from '../actions/auth-actions';
import LoginForm from '../components/auth/login-form';

export default connect(
  state => {
    const {auth: authCtr} = state;
    const {auth, authLoading, authError} = authCtr || {};
    return {
      auth,
      error: authError,
      loading: authLoading
    };
  },
  dispatch => {
    return {
      authActions: bindActionCreators( authActions, dispatch ),
    };
  }
)( LoginForm );
