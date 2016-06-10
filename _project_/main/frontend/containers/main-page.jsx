import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux-reusable'

import MainView from '../components/main-view'

function mapStateToProps( state ) {
  return {
  };
}

function mapDispatchToProps( dispatch ) {
  return {
    // dataActions: bindActionCreators( , dispatch ),
  };
}

export default connect( mapStateToProps, mapDispatchToProps )( MainView );
