import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux-reusable';
import CSSModules from 'react-css-modules';

import styles from './main-view.css';

class MainView extends Component {
  render() {
    return (
      <div>
        <h1>Hello world</h1>
      </div>
    );
  }
}

MainView = CSSModules( MainView, styles );

export default connect(
  state => {
  },
  dispatch => {
  }
)( MainView );
