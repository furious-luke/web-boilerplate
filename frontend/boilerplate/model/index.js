require( 'babel-polyfill' );

import { Component } from 'react';
import { bindActionCreators } from 'redux';
import uuid from 'uuid';
import { Set } from 'immutable';

import * as modelActions from './actions';
import { getObject, updateCollection, removeFromCollection, toArray,
         aliasIdInCollection, isObject, ModelError, splitJsonApiResponse,
         jsonApiFromObject } from './utils';

export function Rollback( message ) {
  this.message = message;
}
Rollback.prototype = Object.create( Error.prototype );
Rollback.prototype.name = 'Rollback';

class Model {

  constructor( type ) {
    this.type = type;
    this.merge = ::this.merge;
  }

  /**
   * Merge endpoint operations. Place the operations on the model
   * itself.
   */
  merge( options ) {
    for( const key of ['list', 'create', 'detail'] ) {
      if( key in options ) {
        this[key] = (...args) => options[key]( ...args ).then( data => {
          console.debug( `Model: ${key}: `, data );
          return data;
        });
      }
    }
    this.relationships = options.relationships || {};
    this.reverseRelationships = {};
    this.indices = options.indices || ['id'];
  }

  /**
   * Update object values.
   */
  update( fromObject, toObject ) {
    let _from = fromObject || {};
    let _to = toObject || {};
    let obj = {
      ..._to,
      ..._from
    };

    // Make sure we have an ID.
    if( obj.id === undefined )
      obj.id = uuid.v4();

    // Convert array relationships to sets.
    for( const name of Object.keys( this.relationships ) ) {
      if( this.relationships[name].many ) {
        if( toObject !== undefined ) {
          const base = _to[name] || new Set();
          obj[name] = base.union( _from[name].add ).subtract( _from[name].del );
        }
        else {
          let base = _from[name];
          if( !Set.isSet( base ) )
            base = new Set( toArray( base ) );
          obj[name] = base;
        }
      }
    }

    return obj;
  }

  toJsonApi( object ) {
    let data = {
      id: object.id,
      type: object._type,
      attributes: {},
      relationships: {}
    };
    for( const field of Object.keys( object ) ) {
      if( field in this.relationships ) {
        data.relationships[field] = {
          data: object[field]
        };
      }
      else if( field != 'id' && field != '_type' )
        data.attributes[field] = object[field];
    }
    return data;
  }

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
          _type: fromObject._type
        }
      };
    }

    // Check for any differences.
    let changedFields = {};
    let fields = new Set( Object.keys( toObject ).concat( Object.keys( fromObject ) ) );
    for( const key of fields ) {
      let fromField = fromObject[key];
      let toField = toObject[key];
      if( key in this.relationships && this.relationships[key].many ) {
        fromField = new Set( fromField || [] );
        toField = new Set( toField || [] );
        changedFields[key] = {
          add: toField.subtract( fromField ),
          del: fromField.subtract( toField )
        };
      }
      else if( fromField != toField )
        changedFields[key] = toObject[key];
    }
    if( Object.keys( changedFields ).length ) {
      return {
        op: 'update',
        object: {
          _type: toObject._type,
          id: toObject.id,
          ...changedFields
        }
      };
    }

    return false;
  }

  applyDiff( diff, head ) {
    const { _type: type, id } = diff.object;
    const coll = head[type];
    let obj;
    if( diff.op == 'update' ) {
      obj = getObject( coll, id, false );
      if( !obj )
        throw new ModelError( `Cannot update model ${type} with ID ${id}; does not exist.` );
    }
    else if( diff.op == 'create' ) {
      if( getObject( coll, id, false ) !== undefined )
        throw new ModelError( `Cannot create model ${type} with ID ${id}; already exists.` );
    }
    else if( diff.op == 'remove' ) {
      if( getObject( coll, id, false ) === undefined )
        throw new ModelError( `Cannot remove model ${type} with ID ${id}; does not exist.` );

      // Remove references to any objects pointing to me.
      // TODO

      return {
        ...head,
        [type]: removeFromCollection( coll, id )
      };
    }

    // Begin updating head.
    const model = schema.getModel( type );
    let newHead = {...head};

    // Remove any modified foreign-keys, and also update any
    // many-to-manys that have been removed.
    if( diff.op == 'update' ) {
      for( const field of Object.keys( diff.object ) ) {
        const info = model.relationships[field];
        if( !info || !info.relatedName )
          continue;
        if( info.many ) {
          for( const fromId of diff.object[field].del )
            newHead = this.removeRelationship( fromId, info.relatedName, {_type: obj._type, id: obj.id}, newHead )
        }
        else {
          const relId = obj[field];
          if( !relId )
            continue;
          if( Set.isSet( relId ) )
            throw 'Likely missing `many=true` on model.';
          newHead = this.removeRelationship( relId, info.relatedName, {_type: obj._type, id: obj.id}, newHead )
        }
      }
    }

    // Update the object with new attributes.
    obj = model.update( diff.object, obj );

    // Add in any relations.
    for( const field of Object.keys( diff.object ) ) {
      const info = model.relationships[field];
      if( !info || !info.relatedName )
        continue;
      if( info.many ) {
        if( diff.op != 'create' ) {
          for( const toId of diff.object[field].add )
            newHead = this.addRelationship( toId, info.relatedName, {_type: obj._type, id: obj.id}, newHead )
        }
        else
          newHead = this.addRelationship( diff.object[field], info.relatedName, {_type: obj._type, id: obj.id}, newHead )
      }
      else {
        const relId = obj[field];
        if( !relId )
          continue;
        newHead = this.addRelationship( relId, info.relatedName, {_type: obj._type, id: obj.id}, newHead )
      }
    }

    // Return the new collection.
    return {
      ...head,
      [type]: updateCollection( coll, obj, model.indices[0], model.indices )
    };
  }

  removeRelationship( fromId, fieldName, relId, head ) {
    console.log( fromId, fieldName, relId );
    const coll = head[fromId._type];
    const fromObj = getObject( coll, {id: fromId.id} );
    const newObj = {
      ...fromObj,
      [fieldName]: fromObj[fieldName].delete( relId )
    };
    return {
      ...head,
      [newObj._type]: updateCollection( coll, newObj )
    }
  }

  addRelationship( toId, fieldName, relId, head ) {
    const coll = head[toId._type];
    const toObj = getObject( coll, {id: relId.id} );
    const newObj = {
      ...toObj,
      [fieldName]: toObj[fieldName].add( relId )
    };
    return {
      ...head,
      [newObj._type]: updateCollection( coll, newObj )
    }
  }
}

export class DB {

  static Rollback = Rollback;

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor( data, options={} ) {
    if( data instanceof Component ) {
      const src = useState ? data.state : data.props;
      const { model = {} } = src;
      this.data = model.db;
      this.useState = options.useState;
      this.component = data;
    }
    else
      this.data = data || {head: {}, chain: {}};
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
      const model = schema.getModel( type );
      const data = objects[type];
      newHead[type] = updateCollection( head[type], data, model.indices[0], model.indices );
    });
    this.data = {
      ...this.data,
      head: newHead
    };

    // Update reverse-related fields.
    for( const type of Object.keys( objects ) ) {
      const model = schema.getModel( type );
      for( const obj of objects[type] ) {
        for( const field of Object.keys( obj ) ) {
          if( !(field in model.relationships) )
            continue;
          const relatedName = model.relationships[field].relatedName;
          if( !relatedName )
            continue;
          if( !obj[field] )
            continue;
          const allRelated = Set.isSet( obj[field] ) ? obj[field] : toArray( obj[field] );
          for( const relId of allRelated ) {
            const relModel = schema.getModel( relId._type );
            const related = this.get( relId );
            if( related === undefined )
              continue;
            const newField = Set.isSet( related[relatedName] ) ? related[relatedName] : new Set();
            const newRelated = {
              ...related,
              [relatedName]: newField.add( {_type: obj._type, id: obj.id} )
            };
            this.data = {
              ...this.data,
              head: {
                ...this.data.head,
                [relId._type]: updateCollection( this.data.head[relId._type], newRelated, relModel.indices[0], relModel.indices )
              }
            };
          }
        }
      }
    }

    // Replay all the diffs to bring us back to the correct position.
    this.redoAll( current );
  }

  /**
   * Get a model from a type and an ID. `type` can be an object,
   * in which case the full query is taken from `type`. If `type`
   * is a string, `idOrQuery` can be just the ID, or an object
   * representing a query.
   */
  get( typeOrQuery, idOrQuery ) {
    if( isObject( typeOrQuery ) ) {
      const { _type, ...query } = typeOrQuery;
      return getObject( this.data.head[_type], query, false );
    }
    else
      return getObject( this.data.head[typeOrQuery], idOrQuery, false );
  }

  /**
   * Begin an atomic transaction.
   */
  withBlock( operation ) {
    if( this._inBlock )
      throw TypeError( 'Already in DB block.' );
    const { chain = {} } = this.data;
    let { blocks = [], current, diffs = [] } = chain;
    if( current === undefined )
      current = diffs.length;
    try {
      operation();
      this.data = {
        ...this.data,
        chain: {
          ...this.data.chain,
          blocks: [...blocks, current]
        }
      };
      this._inBlock = false;
    }
    catch( err ) {
      this.goto( current );
      this.data = {
        ...this.data,
        chain: {
          ...chain
        }
      };
      this._inBlock = false;
      if( !(err instanceof Rollback) )
        throw err;
    }
  }

  getBlockDiffs() {
    const {chain = {}} = this.data;
    const {blocks = [], diffs = []} = chain;
    if( !blocks.length )
      return [];
    return diffs.slice( blocks[blocks.length - 1] );
  }

  /**
   *
   */
  set( typeOrObject, object ) {
    object = isObject( typeOrObject ) ? typeOrObject : {_type: typeOrObject, ...object};
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
    return diffs[((current === undefined) ? diffs.length : current) - 1][0].object.id;
  }

  _set( object ) {
    const { id, _type } = object;

    // Create the diff. Note that we are interested in what
    // needs to be done to *undo* the requested changes.
    const model = schema.getModel( _type );
    const oldObj = this.get( _type, id );
    const newObj = model.update( object, oldObj );
    const undo = model.diff( newObj, oldObj );
    if( !undo )
      return this.data;
    const redo = model.diff( oldObj, newObj );

    // Now add the model to the state, and update the chain.
    const { chain = {}, head = {} } = this.data;
    let { diffs = [], current } = chain;
    if( current === undefined )
      current = diffs.length;
    return {
      head: {
        ...head,
        [_type]: updateCollection( head[_type], newObj, model.indices[0], model.indices )
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

  getOrCreate( type, query ) {
    const obj = this.get( type, query );
    if( obj === undefined )
      return {_type: type, id: uuid.v4(), ...query};
    return obj;
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
    let { diffs = [], current } = chain;
    if( current === undefined )
      current = diffs.length;
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
    const { _type, id } = undo.object;
    const model = schema.getModel( _type );
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
    if( current === undefined )
      current = diffs.length;
    while( current < diffs.length ) {
      this.redo();
      current += 1;
    }
  }

  redo() {

    // Don't try and operate on a non-existant diff.
    const { chain = {}, head = {} } = this.data;
    let { current, diffs = [] } = chain;
    if( current === undefined )
      current = diffs.length;
    if( current == diffs.length )
      return;

    // Calculate the head state with the redo diff applied.
    const [ undo, redo ] = diffs[current];
    const { _type, id } = redo.object;
    const model = schema.getModel( _type );
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

  applyBlock( block ) {
    for( const diff of block )
      this.applyDiff( diff );
    const {chain = {}} = this.data;
    const {blocks = []} = chain;
    this.data = {
      ...this.data,
      chain: {
        ...chain,
        blocks: [...blocks, chain.current - block.length]
      }
    };
  }

  applyDiff( diff ) {
    const {head, chain = {}} = this.data;
    let {current, diffs = []} = chain;
    if( current === undefined )
      current = diffs.length;

    // Calculate the head state with the redo diff applied.
    const [ undo, redo ] = diff;
    const { _type, id } = redo.object;
    const model = schema.getModel( _type );
    const redoneHead = model.applyDiff( redo, head );

    // Update the diff chain and head.
    this.data = {
      head: redoneHead,
      chain: {
        ...chain,
        diffs: [
          ...diffs,
          diff
        ],
        current: current + 1
      }
    };
  }

  /**
   * Move current diff location to `index`.
   */
  goto( index ) {
    const { chain = {} } = this.data;
    let { current, diffs = [] } = chain;
    if( current === undefined )
      current = diffs.length;
    if( index > diffs.length )
      throw ValueError( 'Cannot goto index greater than number of diffs.' );
    if( index < 0 )
      throw ValueError( 'Cannot goto negative index.' );
    while( index < current ) {
      this.undo();
      index += 1;
    }
    while( index > current ) {
      this.redo();
      index -= 1;
    }
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

    // Find the model, convert data to JSON API, and send using
    // the appropriate operation.
    const model = schema.getModel( _diff.object._type );
    const op = (_diff.op == 'update') ? 'detail' : _diff.op;
    return model[op]( model.toJsonApi( _diff.object ) );
  }

  postCommitDiff( diff, response ) {
    if( diff.op == 'create' ) {
      const { data } = response;
      const id = toArray( data )[0].id;
      this.aliasId( diff.object._type, diff.object.id, id );
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
    let newColl = aliasIdInCollection( coll, id, newId );

    // Also need to replace the ID in any diffs.
    const { chain = {} } = this.data;
    const { diffs = [] } = chain;
    let newDiffs = diffs.map( ([undo, redo]) => {
      let newUndo;
      if( undo.object._type == type && undo.object.id == id ) {
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
      if( redo.object._type == type && redo.object.id == id ) {
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
      return [newUndo, newRedo];
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
    this.merge = ::this.merge;
  }

  merge( schema={} ) {
    for( const key of Object.keys( schema ) ) {
      let model = this.models[key];
      if( model === undefined )
        model = new Model( key );
      model.merge( schema[key] );
      this.models[key] = model;

      // TODO: Check this perhaps?
      this[key] = model;
    }

    // Update reverse relationships.
    for( const key of Object.keys( schema ) ) {
      let model = this.models[key];
      for( const relation of Object.keys( model.relationships ) ) {
        const info = model.relationships[relation];
        if( !info.relatedName || !info.type )
          continue;
        let relModel = this.models[info.type];
        relModel.reverseRelationships[info.relatedName] = {
          type: key,
          relatedName: relation
        };
      }
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
