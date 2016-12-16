require( 'babel-polyfill' );

import { bindActionCreators } from 'redux';
import uuid from 'uuid';
import { Map, Set, fromJS } from 'immutable';

import Table from './table';
import { getDiffId, isObject, Rollback, ModelError, splitJsonApiResponse } from './utils';
import * as modelActions from './actions';

export default class DB {

  static Rollback = Rollback;

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor( data, options={} ) {
    this.schema = options.schema;
    if( data ) {
      if( Map.isMap( data ) )
        this.data = data;
      else
        throw new ModelError( 'Unknown data given to DB constructor.' );
    }
    else {
      this.data = fromJS({
        head: {},
        chain: {
          diffs: [],
          current: 0
        }
      });
    }
  }

  resetHead() {
    this.data = this.data.set( 'head', new Map() );
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
    // state of the DB too far.
    const current = this.data.getIn( ['chain', 'current'] );

    // Walk back the diff chain to get the current data into
    // server configuration.
    this.undoAll();

    // Now update the head data state to reflect the new server
    // information.
    this.resetHead();
    Object.keys( objects ).forEach( type => {
      this.data = this.data.updateIn( ['head', type], x => {
        let tbl = new Table( x, {schema: this.schema} );
        objects[type].map( obj => {
          tbl.set( obj );
        });
        return tbl.data;
      });
    });

    // Recalculate reverse-related fields.
    this._updateReverseRelationships();

    // Replay all the diffs to bring us back to the correct position.
    this.redoAll( current );
  }

  _updateReverseRelationships() {
    this.data.get( 'head' ).forEach( (tblData, type) => {
      let tbl = this.getTable( type );
      const model = tbl.getModel();
      model.relationships.forEach( (relInfo, field) => {
        if( relInfo.get( 'reverse' ) )
          return;
        tbl.data.get( 'objects' ).forEach( obj => {
          for( const rel of tbl.iterRelated( obj.id, field ) ) {
            let relTbl = this.getTable( rel._type );
            relTbl.addRelationship( rel.id, relInfo.get( 'relatedName' ), obj );
            this.saveTable( relTbl );
          }
        });
      });
    });
  }

  getTable( type ) {
    return new Table( this.data.getIn( ['head', type] ), {schema: this.schema} );
  }

  saveTable( tbl ) {
    this.data = this.data.setIn( ['head', tbl.getType()], tbl.data );
  }

  /**
   * get( object )
   * get( {_type:, id:}
   * get( '', 3 )
   * get( '', {key: } )
   */
  get( typeOrQuery, idOrQuery ) {
    let query, type;
    if( idOrQuery === undefined ) {
      type = typeOrQuery._type;
      const {_type: x, ...y} = typeOrQuery;
      query = y;
    }
    else if( isObject( idOrQuery ) ) {
      type = typeOrQuery;
      query = idOrQuery;
    }
    else {
      type = typeOrQuery;
      query = {id: idOrQuery};
    }
    return new Table( this.data.getIn( ['head', type] ) ).get( query );
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

  create( data ) {
    const model = this.schema.getModel( data._type );
    let object = model.toObject( data );
    if( object.id === undefined )
      object = object.set( 'id', uuid.v4() );
    const diff = model.diff( undefined, object );
    this.addDiff( diff );
    return getDiffId( diff );
  }

  update( full, partial ) {
    let existing = this.get( full._type, full.id );
    if( existing === undefined )
      throw ModelError( 'Cannot update non-existant object.' );
    const model = this.schema.getModel( existing._type );

    let updated;
    if( partial !== undefined ) {
      updated = existing;
      for( const field of model.iterFields() ) {
        if( field in partial )
          updated = updated.set( field, partial[field] );
      }
    }
    else
      updated = model.toObject( full );

    const diff = model.diff( existing, updated );
    if( diff )
      this.addDiff( diff );
  }

  /* getOrCreate( type, query ) {
     const obj = this.get( type, query );
     if( obj === undefined )
     return {_type: type, id: uuid.v4(), ...query};
     return obj;
     } */

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

  addDiff( diff ) {
    this.data = this.data
                    .updateIn( ['chain', 'diffs'], x => x.push( diff ) )
                    .updateIn( ['chain', 'current'], x => x + 1 );
    this.applyDiff( diff );
  }

  applyDiff( diff ) {
    const id = getDiffId( diff );
    this.data = this.data
                    .updateIn( ['head', id._type], x => {
                      let tbl = this.getTable( id._type );
                      tbl.applyDiff( diff );
                      return tbl.data;
                    });
    this._applyDiffRelationships( diff );
  }

  _applyDiffRelationships( diff ) {
    const id = getDiffId( diff );
    const model = this.schema.getModel( id._type );
    for( const field of model.iterFields() ) {
      if( diff[field] === undefined )
        continue;
      const relInfo = model.relationships.get( field );
      if( !relInfo )
        continue;
      const relName = relInfo.get( 'relatedName' );
      const relType = relInfo.get( 'type' );
      if( relInfo.get( 'reverse' ) || !relName || !relType )
        continue;
      let tbl = this.getTable( relType );
      if( relInfo.get( 'many' ) ) {
        if( diff[field][0] !== undefined ) {
          diff[field][0].forEach( relId => {
            tbl.removeRelationship( relId.id, relName, id );
          });
        }
        if( diff[field][1] !== undefined ) {
          diff[field][1].forEach( relId => {
            tbl.addRelationship( relId.id, relName, id );
          });
        }
      }
      else {
        const relId = diff[field][0];
        if( relId ) {
          let relObj = tbl.get( relId );
          relObj = relObj.set( relName, undefined );
        }
      }
      this.saveTable( tbl );
    }
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
