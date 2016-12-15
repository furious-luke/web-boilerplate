import { List, Map, Set, fromJS, Record } from 'immutable';
import { ModelError, toIndexMap } from './utils';
import uuid from 'uuid';

import { isObject } from './utils';

class Table {

  /**
   * `data` can be one of: a list of objects, a pre-constructed immutable
   * map containing table data, or undefined.
   */
  constructor( data, options ) {
    let {schema, idField='id', indices=['id']} = options || {};
    indices = new Set( indices );
    if( !indices.has( idField ) )
      throw new ModelError( `idField: ${idField} not found in indices: ${indices}` );
    /* if( schema === undefined )
       schema = globalSchema; */
    this.schema = schema;
    this.idField = idField;
    if( data ) {
      if( Array.isArray( data ) ) {
        this.data = new Map({
          objects: this.schema.toObjects( new List( data ) ),
          indices: new Map( indices.toJS().map( x => [x, new Map( toIndexMap( data, x ) )] ) )
        });
      }
      else if( Map.isMap( data ) )
        this.data = data;
      else
        throw new ModelError( 'Unknown data given to table constructor.' );
    }
    else {
      this.data = new Map({
        objects: new List(),
        indices: new Map( indices.toJS().map( x => [x, new Map()] ) )
      });
    }
  }

  /**
   * Get a single object matching the query.
   */
  get( idOrQuery ) {
    const objects = this.filter( idOrQuery );
    if( !objects.size )
      return;
    if( objects.size > 1 )
      throw new ModelError( 'Too many objects returned in table.' );
    return objects.first();
  }

  /**
   * Filter objects based on a query.
   */
  filter( idOrQuery ) {
    return this._filterIndices( idOrQuery ).map( ii => this.data.getIn( ['objects', ii] ) );
  }

  /**
   * Filter objects based on a query, returning the indices.
   */
  _filterIndices( idOrQuery ) {
    if( !isObject( idOrQuery ) )
      idOrQuery = { [this.idField]: idOrQuery };
    let results;
    for( const field in idOrQuery ) {
      let id = idOrQuery[field];
      results = this._reduceIndices( results, field, id );
    }
    return results;
  }

  /**
   * Calculate overlapping indices based on a field/value lookup.
   */
  _reduceIndices( indices, field, value ) {
    const index = this.data.getIn( ['indices', field] );
    if( index === undefined )
      throw new ModelError( `Table index not found: ${field}` );
    const other = index.get( value );
    if( other === undefined )
      return new Set();
    if( indices === undefined )
      return other;
    return indices.intersect( other );
  }

  set( object ) {

    // Must be a better way to convert to a record...
    try {
      object.get( 'id' );
    }
    catch( e ) {
      object = this.schema.toObjects([ object ])[0];
    }

    // If the object doesn't exist, just add it on to the end. Don't
    // worry about adding all the indices, we'll put them in at the
    // end.
    const id = object[this.idField];
    if( id === undefined )
      throw ModelError( 'No ID given for table set.' );
    const existing = this.get( {[this.idField]: id} );
    if( !existing ) {
      const size = this.data.get( 'objects' ).size;
      this.data = this.data
                      .update( 'objects', x => x.push( object ) )
                      .setIn( ['indices', this.idField, id], new Set( [size] ) );
    }
    else {

      // Eliminate the object's index from current indices and set the
      // new object.
      const index = this.data.getIn( ['indices', this.idField, id] ).first();
      this._removeFromIndices( existing );
      this.data = this.data.setIn( ['objects', index], object );
    }

    // Add indices.
    const index = this.data.getIn( ['indices', this.idField, id] ).first();
    this.data.get( 'indices' ).forEach( (ii, field) => {
      if( field == this.idField )
        return;
      const value = object.get( field );
      this.data = this.data.updateIn( ['indices', field, value], x => {
        return (x === undefined) ? new Set( [index] ) : x.add( index );
      });
    });
  }

  /**
   * Eliminate the object's index from current indices.
   */
  _removeFromIndices( object ) {
    const id = object.get( this.idField );
    const index = this.data.getIn( ['indices', this.idField, id] ).first();
    this.data.get( 'indices' ).forEach( (ii, field) => {
      if( field == this.idField )
        return;
      const value = object.get( field );

      // Remove the object's ID from the index.
      this.data = this.data.updateIn( ['indices', field, value], x => x.delete( index ) );

      // Remove the index if it's now empty.
      if( this.data.getIn( ['indices', field, value] ).size == 0 )
        this.data = this.data.deleteIn( ['indices', field, value] );
    });
  }

  remove( idOrQuery ) {
    const obj = this.get( idOrQuery );
    if( !obj )
      return;
    const id = obj.get( 'id' );
    const index = this.data.getIn( ['indices', this.idField, id] ).first();

    // Remove from extra indices and also the ID index.
    this._removeFromIndices( obj );
    this.data = this.data.deleteIn( ['indices', this.idField, id] );

    // Can't remove the object or I ruin the indices.
    // TODO: Fix this.
    this.data = this.data.setIn( ['objects', index], null );
  }

  reId( oldId, newId ) {
    const index = this.data.getIn( ['indices', this.idField, oldId] ).first();
    this.data = this.data
                    .deleteIn( ['indices', this.idField, oldId] )
                    .setIn( ['indices', this.idField, newId], new Set( [index] ) )
                    .setIn( ['objects', index, this.idField], newId );
  }
}

export default Table;
