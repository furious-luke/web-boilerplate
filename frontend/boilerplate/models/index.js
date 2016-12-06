require( 'babel-polyfill' );

import { Component } from 'react';
import { bindActionCreators } from 'redux';
import uuid from 'uuid';

import * as modelActions from '../actions/model-actions';
import { getObject, initCollection, updateCollection, removeFromCollection,
         ModelError, splitJsonApiResponse } from '../reducers/model-utils';

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

  update( fromObject, toObject ) {
    let _from = fromObject || {};
    let _to = toObject || {};
    let obj = {
      ..._to,
      ..._from,
      attributes: {
        ...(_to.attributes || {}),
        ...(_from.attributes || {})
      },
      relationships: {
        ...(_to.relationships || {}),
        ...(_from.relationships || {})
      }
    };
    if( obj.id === undefined )
      obj.id = uuid.v4();
    return obj;
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

  diff( fromObject, toObject ) {

    // Check for creation.
    if( fromObject === undefined ) {
      if( toObject === undefined )
        return;
      return {
        op: 'create',
        object: toObject
      };
    }

    // Check for remove.
    if( toObject === undefined ) {
      return {
        op: 'remove',
        object: {
          id: fromObject.id,
          type: fromObject.type
        }
      };
    }

    // Check for any differences.
    let changedFields = [];
    let fields = new Set( Object.keys( toObject.attributes ).concat( Object.keys( fromObject.attributes )));
    for( const key of fields ) {
      const fromField = fromObject.attributes[key];
      const toField = toObject.attributes[key];
      if( fromField != toField )
        changedFields.push( key );
    }
    if( changedFields.length ) {
      return {
        op: 'update',
        object: toObject,
        fields: changedFields
      };
    }

    return false;
  }

  applyDiff( diff, head ) {
    const { type, id } = diff.object;
    let obj;
    if( diff.op == 'update' ) {
      obj = getObject( head, type, id );
      if( !obj )
        throw new ModelError( `Cannot update model ${type} with ID ${id}; does not exist.` );
    }
    else if( diff.op == 'create' ) {
      if( getObject( head, type, id ) !== undefined )
        throw new ModelError( `Cannot create model ${type} with ID ${id}; already exists.` );
      obj = {
        type,
        attributes: {},
        relationships: {}
      };
    }
    else if( diff.op == 'remove' ) {
      if( getObject( head, type, id ) === undefined )
        throw new ModelError( `Cannot remove model ${type} with ID ${id}; does not exist.` );
      return {
        ...head,
        [type]: removeFromCollection( head[type], id )
      };
    }

    // Update the object with new attributes.
    const model = schema.getModel( type );
    obj = model.update( diff.object, obj );

    // Add the object to the head state.
    let coll = head[type];
    return {
      ...head,
      [type]: updateCollection( coll, obj )
    };
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
      this.data = data || { head: {}, chain: {} };
  }

  bindDispatch( dispatch ) {
    this.dispatch = dispatch;
    this.actions = bindActionCreators( modelActions, dispatch );
  }

  /**
   * Load models from JSON API format.
   */
  loadJsonApi( response ) {
    const objects = splitJsonApiResponse( response );

    // Cache the latest redo position. We don't want to revert the
    // state of the DB to far.
    const { chain = {} } = this.data;
    const { current } = chain;

    // Walk back the diff chain to get the current data into
    // server configuration.
    this.undoAll();

    // Now update the head data state to reflect the new server
    // information.
    const { head = {} } = this.data;
    let newHead = {};
    Object.keys( objects ).forEach( type => {
      const data = objects[type];
      newHead[type] = updateCollection( head[type], data );
    });

    // Replay all the diffs to bring us back to the correct position.
    this.data = {
      ...this.data,
      head: newHead
    };
    this.redoAll( current );
  }

  /**
   * Get a model from a type and an ID.
   */
  get( type, id ) {
    if( type.constructor === Object ) {
      id = type.id;
      type = type.type;
    }
    return getObject( head || this.data.head, type, id );
  }

  /**
   *
   */
  set( object ) {
    if( this.component ) {
      if( !this.useState )
        this.actions.setModel( object );
      else {
        this.component.setState({
          model: {
            ...this.component.state.model,
            db: this._set( object  )
          }
        });
      }
    }
    else
      this.data = this._set( object );

    // Return the ID of the object. This is useful when we create
    // an object and don't know what ID was used.
    const { diffs, current } = this.data.chain;
    return diffs[current - 1][0].object.id;
  }

  _set( object ) {
    const { id, type } = object;

    // Create the diff. Note that we are interested in what
    // needs to be done to *undo* the requested changes.
    const model = schema.getModel( type );
    const oldObj = this.get( type, id );
    const newObj = model.update( object, oldObj );
    const undo = model.diff( newObj, oldObj );
    if( !undo )
      return this.data;
    const redo = model.diff( oldObj, newObj );

    // Now add the model to the state, and update the chain.
    const { chain = {}, head = {} } = this.data;
    const { diffs = [], current = 0 } = chain;
    return {
      head: {
        ...head,
        [type]: updateCollection( head[type], newObj )
      },
      chain: {
        diffs: [
          ...diffs,
          [undo, redo]
        ],
        current: current + 1
      }
    };
  }

  remove( type, id ) {

    // Create the diff. Note that we are interested in what
    // needs to be done to *undo* the requested changes.
    const model = schema.getModel( type );
    const oldObj = this.get( type, id );
    const undo = model.diff( undefined, oldObj );
    if( !undo )
      return this.data;
    const redo = model.diff( oldObj, undefined );

    // Now add the model to the state, and update the chain.
    const { chain = {}, head = {} } = this.data;
    const { diffs = [], current = 0 } = chain;
    this.data = {
      head: {
        ...head,
        [type]: removeFromCollection( head[type], id )
      },
      chain: {
        diffs: [
          ...diffs,
          [undo, redo]
        ],
        current: current + 1
      }
    };
  }

  undoAll() {
    const { chain = {} } = this.data;
    let { current } = chain;
    while( current ) {
      this.undo();
      current -= 1;
    }
  }

  undo() {

    // Don't try and operate on a non-existant diff.
    const { chain = {}, head = {} } = this.data;
    const { current, diffs = [] } = chain;
    if( !current )
      return;

    // Calculate the head state with the undo diff applied.
    const [ undo, redo ] = diffs[current - 1];
    const { type, id } = undo.object;
    const model = schema.getModel( type );
    const undoneHead = model.applyDiff( undo, head );

    // Update the diff chain and head.
    this.data = {
      head: undoneHead,
      chain: {
        ...chain,
        current: current - 1
      }
    };
  }

  redoAll() {
    const { chain = {} } = this.data;
    const { diffs = [] } = chain;
    let { current } = chain;
    while( current < diffs.length ) {
      this.redo();
      current += 1;
    }
  }

  redo() {

    // Don't try and operate on a non-existant diff.
    const { chain = {}, head = {} } = this.data;
    const { current = 0, diffs = [] } = chain;
    if( current == diffs.length )
      return;

    // Calculate the head state with the redo diff applied.
    const [ undo, redo ] = diffs[current];
    const { type, id } = redo.object;
    const model = schema.getModel( type );
    const redoneHead = model.applyDiff( redo, head );

    // Update the diff chain and head.
    this.data = {
      head: redoneHead,
      chain: {
        ...chain,
        current: current + 1
      }
    };
  }

  /**
   *
   */
  commitDiff( diff ) {

    // If no diff was given, use the oldest one available.
    // If no such diff is available then return.
    let _diff;
    if( !diff ) {
      const { chain = {} } = this.data;
      const { diffs, server = 0, current } = chain;
      if( !diffs || (server !== undefined && server == current) )
        return;
      _diff = diffs[0][1];
    }
    else
      _diff = diff;

    const model = schema.getModel( _diff.object.type );
    const op = (_diff.op == 'update') ? 'detail' : _diff.op;
    return model[op]( _diff.model );
  }

  postCommitDiff( diff, response ) {
    if( diff.op == 'create' ) {
      const { data } = response;
      const id = (data instanceof Array) ? data[0].id : data.id;
      this.aliasId( _diff.object.type, _diff.object.id, id );
    }
  }

  popDiff() {
    const { chain = {} } = this.data;
    const { diffs, server = 0 } = chain;
    this.data = {
      ...this.data,
      chain: {
        ...chain,
        server: server + 1
      }
    };
  }

  aliasId( type, id, newId ) {

    // Build the new collection for the type in question.
    const { head } = this.data;
    const coll = head[type];
    if( !coll )
      return;
    const { objects = [], map = {}, alias = {} } = coll;
    if( !(id in map) )
      return coll;
    const index = map[id];
    let newMap = {
      ...map,
      [newId]: index
    };
    delete newMap[id];
    let newColl = {
      objects: [
        ...objects.slice( 0, index ),
        {
          ...objects[index],
          id: newId
        },
        ...objects.slice( index + 1 )
      ],
      map: newMap,
      alias: {
        ...alias,
        [id]: newId
      }
    }

    // Also need to replace the ID in any diffs.
    const { chain = {} } = this.data;
    const { diffs = [] } = chain;
    let newDiffs = diffs.map( ([undo, redo]) => {
      let newUndo;
      if( undo.object.id == id ) {
        newUndo = {
          ...undo,
          object: {
            ...undo.object,
            id: newId
          }
        }
      }
      else
        newUndo = undo;
      let newRedo;
      if( redo.object.id == id ) {
        newRedo = {
          ...redo,
          object: {
            ...redo.object,
            id: newId
          }
        }
      }
      else
        newRedo = redo;
      return [ newUndo, newRedo ];
    });

    this.data = {
      ...this.data,
      head: {
        ...head,
        [type]: newColl
      },
      chain: {
        ...chain,
        diffs: newDiffs
      }
    };
  }

  /**
   *
   */
  /* *calcOrderedDiffs() {
     const { local } = this.data;
     let done = {};
     for( const type of Object.keys( local ) ) {
     for( const obj of local[type].objects ) {
     for( const diff of this._calcOrderedDiffs( type, obj.id, done ) )
     yield diff;
     }
     }
     } */

  /* *_calcOrderedDiffs( type, id, done={} ) {
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
     } */
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
