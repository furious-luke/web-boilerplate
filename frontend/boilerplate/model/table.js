import { List, Map, Set, fromJS, Record } from 'immutable';
import { ModelError, toIndexMap } from './utils';
import uuid from 'uuid';

import { getDiffId, ID, isObject } from './utils';

class Table {

  /**
   * `data` can be one of: a list of objects, a pre-constructed immutable
   * map containing table data, or undefined.
   */
  constructor( type, options ) {
    this.type = type;
    let {data, schema, idField='id', indices} = options || {};
    if( !indices )
      indices = schema.getModel( type ).indices;
    if( !indices )
      indices = ['id'];
    indices = new Set( indices );
    if( !indices.has( idField ) )
      throw new ModelError( `idField: ${idField} not found in indices: ${indices}` );
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
      object = this.schema.toObject( object );
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
      const index = this._getIndex( id );
      this._removeFromIndices( existing );
      this.data = this.data.setIn( ['objects', index], object );
    }

    // Add indices.
    const index = this._getIndex( id );
    this.data.get( 'indices' ).forEach( (ii, field) => {
      if( field == this.idField )
        return;
      const value = object.get( field );
      this.data = this.data.updateIn( ['indices', field, value], x => {
        return (x === undefined) ? new Set( [index] ) : x.add( index );
      });
    });
  }

  _getIndex( id ) {
    return this.data.getIn( ['indices', this.idField, id] ).first();
  }

  /**
   * Eliminate the object's index from current indices.
   */
  _removeFromIndices( object ) {
    const id = object.get( this.idField );
    const index = this._getIndex( id );
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
    const index = this._getIndex( id );

    // Remove from extra indices and also the ID index.
    this._removeFromIndices( obj );
    this.data = this.data.deleteIn( ['indices', this.idField, id] );

    // Can't remove the object or I ruin the indices.
    // TODO: Fix this.
    this.data = this.data.setIn( ['objects', index], null );
  }

  reId( oldId, newId ) {
    const index = this._getIndex( oldId );
    this.data = this.data
                    .deleteIn( ['indices', this.idField, oldId] )
                    .setIn( ['indices', this.idField, newId], new Set( [index] ) )
                    .setIn( ['objects', index, this.idField], newId );
  }

  forEachRelatedObject( id, callback ) {
    const obj = this.get( id );
    const model = this.getModel();
    for( const field of model.iterForeignKeys() ) {
      const relName = model.relationships.getIn( [field, 'relatedName'] );
      if( obj[field] )
        callback( obj[field], relName );
    }
    for( const field of model.iterManyToMany() ) {
      const relName = model.relationships.getIn( [field, 'relatedName'] );
      for( const rel of obj[field] )
        callback( rel, relName );
    }
  }

  addRelationship( id, field, related ) {
    const index = this._getIndex( id );
    this.data = this.data.updateIn( ['objects', index, field], x => x.add( ID( related ) ) );
  }

  removeRelationship( id, field, related ) {
    const index = this._getIndex( id );
    this.data = this.data.updateIn( ['objects', index, field], x => x.delete( ID( related ) ) );
  }

  *iterRelated( id, field ) {
    const obj = this.get( id );
    if( obj ) {
      const model = this.schema.getModel( obj._type );
      if( model.relationships.getIn( [field, 'many'] ) ) {
        for( const rel of obj[field] )
          yield rel;
      }
      else if( obj[field] )
        yield obj[field];
    }
  }

  applyDiff( diff, reverse=false ) {
    const ii = reverse ? 1 : 0;
    const jj = reverse ? 0 : 1;
    const id = getDiffId( diff );
    let obj = this.get( id.id );
    const model = this.getModel();

    // Creation.
    if( diff._type[ii] === undefined ) {
      if( obj !== undefined )
        throw ModelError( 'Trying to create an object that already exists.' );
      let newObj = {};
      Object.keys( diff ).forEach( x => newObj[x] = diff[x][jj] );
      this.set( model.toObject( newObj ) );
    }

    // Removal.
    else if( diff._type[jj] === undefined ) {
      if( obj === undefined )
        throw ModelError( 'Trying to remove an object that doesn\'t exist.' );
      this.remove( diff.id[ii] );
    }

    // Update.
    else {
      if( obj === undefined )
        throw ModelError( 'Trying to update an object that doesn\'t exist.' );
      Object.keys( diff ).forEach( x => {
        const relInfo = model.relationships.get( x );
        if( relInfo && relInfo.get( 'many' ) ) {
          diff[x][ii].forEach( y => obj = obj.set( x, obj[x].delete( ID( y ) ) ) );
          diff[x][jj].forEach( y => obj = obj.set( x, obj[x].add( ID( y ) ) ) );
        }
        else
          obj = obj.set( x, diff[x][jj] )
      });
      this.set( model.toObject( obj ) );
    }
  }

  getModel() {
    return this.schema.getModel( this.type );
  }

  getType() {
    const obj = this.data.getIn( ['objects', 0] );
    if( obj )
      return obj._type;
  }
}

export default Table;
