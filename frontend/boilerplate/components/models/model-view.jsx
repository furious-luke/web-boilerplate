import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as modelActions from '../../actions/model-actions';
import { mergeCollections, condense } from '../../reducers/model-utils';

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

      // Put the collections state on the results, with a
      // couple of helper methods to extract values.
      const { model: modelState } = state;
      const { collections } = modelState;
      let models = {
        collections
      };
      models.get = function( type, id ) {
        return this[type].objects[this[type].map[id]];
      }
      models.get = models.get.bind( models );
      
      // Extract the view metadata.
      const { name, query } = options || {};
      const { views } = modelState;
      let data = {
        models
      };
      if( name in views ) {
        data = {
          ...data,
          ...views[name]
        };

        // Condense the requested models.
        for( const key of Object.keys( query ) ) {
          if( key in data )
            data[key] = condense( modelState, data[key] );
        }
      }

      console.debug( 'ModelView: ', data );
      return data;
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class ModelView extends Component {

      /**
       * Need to load the requried models.
       */
      componentWillMount() {
        console.debug( 'SyncedComponent: Loading model view.' );
        this.props.loadModelView({ ...options, props: this.props });
      }

      render() {
        return <ComposedComponent { ...this.props } />;
      }
    }

  );

}
