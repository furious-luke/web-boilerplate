import React, { Component, PropTypes } from 'react';
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

export default CSSModules( MainView, styles );
