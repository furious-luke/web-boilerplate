require( 'babel-polyfill' );

import { Component } from 'react';
import { bindActionCreators } from 'redux';
import uuid from 'uuid';

import * as modelActions from '../actions/model-actions';
import { getLocal, getServer, initCollection, updateCollection,
         splitJsonApiResponse } from '../reducers/model-utils';

class Model {

  constructor( type ) {
    this.type = type;
  }

  /**
   * Merge endpoint operations.
   */
  merge( options ) {
    for( const key of [ 'list', 'create', 'detail' ] ) {
      if( key in options ) {

        // Add the call to the model itself.
        this[key] = (...args) => options[key]( ...args ).then( data => {
          console.debug( `Model: ${key}: `, data );
          /* const res = this.fromJsonApi( data );
             console.debug( `Model: ${key}: `, res ); */
          return data;
        });

        /* this[key].type = this.type; */
      }
    }
  }

  /* modelFromJsonApi( object ) {
     const { relationships = {}, ...rest } = object;
     let relations = {};
     for( const rel of Object.keys( relationships ) )
     relations[rel] = relationships[rel].data;
     return {
     ...rest,
     relationships: relations
     };
     }

     fromJsonApi( response ) {
     const { data, included = [] } = response || {};
     const _data = (data instanceof Array) ? data : [ data ];
     let results = [
     _data.map( o => this.modelFromJsonApi( o ) ),
     included.map( o => this.modelFromJsonApi( o ) ),
     ];
     if( !(data instanceof Array) )
     results[0] = results[0][0];
     return results;
     } */

  diff( localModel, serverModel ) {

    // Check for creation.
    if( serverModel === undefined ) {
      return {
        op: 'create',
        model: localModel
      };
    }

    // TODO: How to check for delete?

    // Check for any differences.
    let changedFields = [];
    for( const key of Object.keys( localModel.attributes ) ) {
      const serverField = serverModel.attributes[key];
      const localField = localModel.attributes[key];
      if( serverField != localField )
        changedFields.push( key );
    }
    if( changedFields.length ) {
      return {
        op: 'updated',
        model: localModel,
        fields: changedFields
      };
    }

    return false;
  }
}

export class DB {

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor( data, useState=false ) {
    if( data instanceof Component ) {
      const src = useState ? data.state : data.props;
      const { model = {} } = src;
      this.data = model.db;
      this.useState = useState;
      this.component = data;
    }
    else
      this.data = data || { server: {}, local: {} };
  }

  bindDispatch( dispatch ) {
    this.dispatch = dispatch;
    this.actions = bindActionCreators( modelActions, dispatch );
  }

  loadJsonApi( response ) {
    const objects = splitJsonApiResponse( response );
    let server = {
      ...this.data.server || {}
    };

    // Iterate over the model types and the new collections.
    Object.keys( objects ).forEach( type => {
      const data = objects[type];
      if( server[type] === undefined )
        server[type] = initCollection( data );
      else
        server[type] = updateCollection( server[type], data );
    });

    this.data = {
      ...this.data,
      server
    };
  }

  /**
   * Get a model from a type and an ID.
   */
  get( type, id ) {
    if( type.constructor === Object ) {
      id = type.id;
      type = type.type;
    }
    let mod = getLocal( this.data, type, id );
    if( mod === undefined )
      mod = getServer( this.data, type, id );
    return mod;
  }

  /**
   * Get a model from a type and an ID from the server collections.
   */
  getServer( type, id ) {
    if( type.constructor === Object ) {
      id = type.id;
      type = type.type;
    }
    return getServer( this.data, type, id );
  }

  /**
   *
   */
  set( modelData ) {
    if( this.component ) {
      if( !this.useState )
        this.actions.setModel( modelData );
      else {
        this.component.setState({
          model: {
            ...this.component.state.model,
            db: this._setModelData( modelData  )
          }
        });
      }
    }
    else
      this.data = this._setModelData( modelData );
  }

  /**
   *
   */
  commitDiff( diff ) {
    const model = schema.getModel( type );
    const op = (diff.op == 'update') : 'detail' : diff.op;
    return model[op]( diff.model );
  }

  /**
   *
   */
  *calcOrderedDiffs() {
    const { local } = this.data;
    let done = {};
    for( const type of Object.keys( local ) ) {
      for( const obj of local[type].objects ) {
        for( const diff of this._calcOrderedDiffs( type, obj.id, done ) )
          yield diff;
      }
    }
  }

  *_calcOrderedDiffs( type, id, done={} ) {
    if( type in done && id in done[type] )
      return;
    if( !(type in done) )
      done[type] = {};
    done[type][id] = true;
    const obj = this.get( type, id );
    const { relationships = {} } = obj;
    const model = schema.getModel( type );
    for( const relType of Object.keys( relationships ) ) {
      let relData = relationships[relType].data || [];
      if( !(relData instanceof Array) )
        relData = [ relData ];
      for( const rel of relData ) {
        for( const relDiff of this._calcOrderedDiffs( relType, rel.id, done ) )
          yield relDiff;
      }
    }
    const diff = model.diff( obj, this.getServer( type, id ) );
    if( diff )
      yield diff;
  }

  /**
   *
   */
  _setModelData( modelData, destination='local' ) {
    const { id, type } = modelData;

    // Check if this is an update. If it's an update we need to locate
    // the existing model and merge attributes.
    let obj;
    if( id !== undefined ) {
      let existing = getLocal( this.data, type, id );
      if( existing === undefined )
        existing = getServer( this.data, type, id );
      if( existing !== undefined )
        obj = existing;
      else
        throw ModelError( `Unable to find a model of type ${type} with ID ${id}.` );
    }
    else {
      obj = {
        id: uuid.v4(),
        type,
        attributes: {},
        relationships: {}
      };
    }

    // Update the object with new attributes.
    obj = {
      ...obj,
      attributes: {
        ...obj.attributes,
        ...(modelData.attributes || {})
      },
      relationships: {
        ...obj.relationships,
        ...(modelData.relationships || {})
      }
    };
      
    // Now add the model to the state.
    return {
      ...this.data,
      [destination]: {
        ...this.data[destination],
        [type]: updateCollection( this.data[destination][type], obj )
      }
    };
  }
}

class Schema {

  constructor() {
    this.models = {};
  }

  merge( schema = {} ) {
    for( const key of Object.keys( schema ) ) {
      let model = this.models[key];
      if( model === undefined )
        model = new Model( key );
      model.merge( schema[key] );
      this.models[key] = model;

      // TODO: Check this perhaps?
      this[key] = model;
    }
  }

  getModel( type ) {
    if( !(type in this.models) )
      console.error( `No model registered as "${type}".` );
    return this.models[type];
  }

  calcDiffs( state ) {
    let diffs = [];
    const { collections: { local }} = state;
    for( const type of Object.keys( local ) ) {
      for( const id of Object.keys( local[type] ) ) {
        const result = Model.calcDiff( state, type, id );
        if( result )
          diffs.append( result );
      }
    }
    return diffs;
  }

  sync() {
    const diffs = this.calcDiffs();
    let deferred = [];
    for( const diff of diffs ) {
      let def;
      if( diff.op == 'create' )
        def = this.create( diff )
      else if( diff.op == 'remove' )
        def = this.remove( diff );
      else
        def = this.update( diff );
      deferred.push( def );
    }
    return Promise.all( deferred )
                  .then( () => diffs );
  }

  create( diff ) {
    const type = diff.model.type.toLowerCase();
    return this[type].create( diff.model );
  }

  remove( diff ) {
    const type = diff.model.type.toLowerCase();
    return this[type].remove( diff.model.id );
  }

  update( diff ) {
    const type = diff.model.type.toLowerCase();
    let fields = {};
    for( const name of diff.fields )
      fields[name] = diff.model.attributes[name];
    const data = {
      id: diff.model.id,
      attributes: fields
    };
    return this[type].update( data );
  }
}

let schema = new Schema();

export default schema;
