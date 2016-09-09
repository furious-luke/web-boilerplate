import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux-reusable';

import authActions from '../actions/auth-actions';
import LoginForm from '../components/auth/login-form';

export default connect(
  state => {
    const { auth: authCtr } = state;
    const { auth, authLoading, authError } = authCtr || {};
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
