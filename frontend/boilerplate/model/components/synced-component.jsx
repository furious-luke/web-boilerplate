import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as modelActions from '../actions';
import { mergeCollections, collect, initCollection } from '../reducers';
import { DB } from '..';

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const { name } = options || {};
      const { model = {} } = state;
      const { views = {} } = model;
      const data = views[name] || {};
      const db = new DB( model.db );
      console.debug( 'SyncedComponent: ', data );
      return {
        ...data,
        db
      };
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class SyncedComponent extends Component {

      /**
       * Need to load the requried models.
       */
      componentWillMount() {
        console.debug( 'SyncedComponent: Loading.' );
        this.props.loadModelView({ ...options, props: this.props });
      }

      render() {
        return <ComposedComponent { ...this.props } />;
      }
    }

  );

}
