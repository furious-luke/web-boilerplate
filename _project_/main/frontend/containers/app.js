import React, { Component, PropTypes } from 'react'

export default class App extends Component {

  static propTypes = {
    children: PropTypes.element.isRequired
  };

  render() {
    let devContent;
    if( process.env.NODE_ENV !== 'production' ) {
      const DevTools = require( './dev-tools' ).default;
      devContent = <DevTools />;
    }
    return (
      <div>
        { this.props.children }
        { devContent }
      </div>
    );
  }
}
