require( 'babel-polyfill' );

import { bindActionCreators } from 'redux';
import uuid from 'uuid';
import { List, Map } from 'immutable';

import Table from './table';
import { makeId, getDiffOp, getDiffId, isObject, Rollback, ModelError, splitJsonApiResponse } from './utils';
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
    else
      this.reset();
  }

  reset() {
    this.data = new Map({
      head: new Map(),
      chain: new Map({
        diffs: new List(),
        blocks: new List(),
        current: 0,
        server: 0
      })
    });
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
//    this.resetHead();
    Object.keys( objects ).forEach( type => {
      this.data = this.data.updateIn( ['head', type], x => {
        let tbl = new Table( type, {data: x, schema: this.schema} );
        objects[type].map( obj => {
          tbl.set( obj );
        });
        return tbl.data;
      });
    });

    // Recalculate reverse-related fields.
    this._updateReverseRelationships();

    // Replay all the diffs to bring us back to the correct position.
    this.goto( current );
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
    const data = this.data.getIn( ['head', type] );
    return new Table( type, {data, schema: this.schema} );
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
      if( typeOrQuery._map !== undefined ) {
        query = {id: typeOrQuery.id};
      }
      else {
        const {_type: x, ...y} = typeOrQuery;
        query = y;
      }
    }
    else if( isObject( idOrQuery ) ) {
      type = typeOrQuery;
      query = idOrQuery;
    }
    else {
      type = typeOrQuery;
      query = {id: idOrQuery};
    }
    const data = this.data.getIn( ['head', type] );
    return new Table( type, {data, schema: this.schema} ).get( query );
  }

  getOrCreate( type, query, values ) {
    let obj = this.get( type, query );
    if( !obj ) {
      const id = this.create({
        _type: type,
        ...query,
        ...values
      });
      obj = this.get( id );
    }
    else {
      const model = this.schema.getModel( type );
      obj = model.update( obj, values );
      this.update( obj );
    }
    return obj;
  }

  /**
   * Begin an atomic transaction.
   */
  withBlock( operation ) {
    if( this._inBlock )
      throw ModelError( 'Already in DB block.' );
    const chain = this.data.get( 'chain' );
    const current = chain.get( 'current' );
    try {
      operation();
      this.data = this.data.updateIn( ['chain', 'blocks'], x => x.push( current ) );
      this._inBlock = false;
    }
    catch( err ) {
      this.goto( current );
      this.data = this.data.set( 'chain', chain );
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

  remove( typeOrObject, id ) {
    let type;
    if( id === undefined ) {
      type = typeOrObject._type;
      id = typeOrObject.id;
    }
    else
      type = typeOrObject;
    const model = this.schema.getModel( type );
    let object = this.get( makeId( type, id ) );
    const diff = model.diff( object, undefined );
    this.addDiff( diff );
  }

  undoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    while( current ) {
      this.undo();
      current -= 1;
    }
  }

  undo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( !current )
      return;
    let diff = diffs.get( current - 1 );
    this.applyDiff( diff, true );
    this.data = this.data.setIn( ['chain', 'current'], current - 1 );
  }

  redoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    while( current < diffs.size ) {
      this.redo();
      current += 1;
    }
  }

  redo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( current == diffs.size )
      return;
    let diff = diffs.get( current );
    this.applyDiff( diff );
    this.data = this.data.setIn( ['chain', 'current'], current + 1 );
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

  applyDiff( diff, reverse=false ) {
    const id = getDiffId( diff );
    this.data = this.data
                    .updateIn( ['head', id._type], x => {
                      let tbl = this.getTable( id._type );
                      tbl.applyDiff( diff, reverse );
                      return tbl.data;
                    });
    this._applyDiffRelationships( diff, reverse );
  }

  _applyDiffRelationships( diff, reverse=false ) {
    const ii = reverse ? 1 : 0;
    const jj = reverse ? 0 : 1;
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
        if( diff[field][ii] !== undefined ) {
          diff[field][ii].forEach( relId => {
            tbl.removeRelationship( relId.id, relName, id );
          });
        }
        if( diff[field][jj] !== undefined ) {
          diff[field][jj].forEach( relId => {
            tbl.addRelationship( relId.id, relName, id );
          });
        }
      }
      else {

        // Don't update the reverse relationships if the value
        // hasn't changed.
        if( diff[field][ii] != diff[field][jj] ) {
          let relId = diff[field][ii]
          if( relId )
            tbl.removeRelationship( relId.id, relName, id );
          relId = diff[field][jj]
          if( relId )
            tbl.addRelationship( relId.id, relName, id );
        }
      }
      this.saveTable( tbl );
    }
  }

  /**
   * Move current diff location to `index`.
   */
  goto( index ) {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( index > diffs.size )
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
    if( !diff ) {
      const server = this.data.getIn( ['chain', 'server'] );
      const current = this.data.getIn( ['chain', 'current'] );
      const diffs = this.data.getIn( ['chain', 'diffs'] );
      if( server >= current )
        return;
      diff = diffs[server];
    }

    // Find the model, convert data to JSON API, and send using
    // the appropriate operation.
    const model = this.schema.getModel( getDiffId( diff )._type );
    const op = getDiffOp( diff );
    const data = model.diffToJsonApi( diff );
    let promise = model[op]( data );

    // Add on any many-to-many values.
    for( const field of model.iterManyToMany() ) {
      if( field in diff ) {
        promise = promise.then( () => {
          return model[`${field}Add`] ( diff[field][1] );
        })
        .then( () => {
          return model[`${field}Remove`] ( diff[field][0] );
        });
      }
    }
  }

  postCommitDiff( diff, response ) {
    if( getDiffOp( diff ) == 'create' ) {
      const {data} = response;
      const id = toArray( data )[0].id;
      this.reId( diff._type[1], diff.id[1], id );
    }
  }

  popDiff() {
    this.data = this.data.updateIn( ['chain', 'server'], x => x + 1 );
  }

  reId( type, id, newId ) {

    // Update the ID of the object itself.
    let tbl = this.getTable( type );
    tbl.reId( id, newId );
    this.saveTable( tbl );

    // Now update the relationships.
    const model = this.schema.getModel( type );
    const fromId = makeId( type, id );
    const toId = makeId( type, newId );
    tbl.forEachRelatedObject( newId, (objId, reverseField) => {
      const obj = this.get( objId );
      const relTbl = this.getTable( obj._type );
      relTbl.removeRelationship( obj.id, reverseField, fromId );
      relTbl.addRelationship( obj.id, reverseField, toId );
      this.saveTable( relTbl );
    });

    // Finally, update any references in diffs.
    // TODO: This is slow and shit.
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    for( let ii = 0; ii < diffs.size; ++ii ) {
      const diff = diffs.get( ii );
      let newDiff = {
        id: [diff.id[0], diff.id[1]]
      };
      let changed = false;
      if( diff.id[0] == id ) {
        newDiff.id[0] = newId;
        changed = true;
      }
      if( diff.id[1] == id ) {
        newDiff.id[1] = newId;
        changed = true;
      }
      const relModel = this.schema.getModel( getDiffId( diff )._type );
      for( const field of relModel.iterForeignKeys() ) {
        if( diff[field] ) {
          newDiff[field] = [diff[field][0], diff[field][1]];
          if( diff[field][0] == fromId ) {
            newDiff[field][0] = toId;
            changed = true;
          }
          if( diff[field][1] == fromId ) {
            newDiff[field][1] = toId;
            changed = true;
          }
        }
      }
      for( const field of relModel.iterManyToMany() ) {
        if( diff[field] ) {
          newDiff[field] = [diff[field][0], diff[field][1]];
          if( diff[field][0].has( fromId ) ) {
            newDiff[field][0] = newDiff[field][0].delete( fromId ).add( toId );
            changed = true;
          }
          if( diff[field][1].has( fromId ) ) {
            newDiff[field][1] = newDiff[field][1].delete( fromId ).add( toId );
            changed = true;
          }
        }
      }
      if( changed )
        this.data = this.data.updateIn( ['chain', 'diffs', ii], x => Object( {...x, ...newDiff} ) );
    }
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
