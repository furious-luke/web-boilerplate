import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux-reusable'

import authActions from '../actions/auth-actions'
import LoginForm from '../components/auth/login-form'

function mapStateToProps( state ) {
  const { auth: authCtr } = state;
  const { auth, authLoading, authError } = authCtr || {};
  return {
    auth,
    error: authError,
    loading: authLoading
  };
}

function mapDispatchToProps( dispatch ) {
  return {
    authActions: bindActionCreators( authActions, dispatch ),
  };
}

export default connect( mapStateToProps, mapDispatchToProps )( LoginForm );
