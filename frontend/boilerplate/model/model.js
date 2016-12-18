require( 'babel-polyfill' );

import { OrderedSet, Set, Record, fromJS } from 'immutable';
import uuid from 'uuid';

import { getDiffOp, ID, toArray } from './utils';

export default class Model {

  constructor( type ) {
    this.type = type;
  }

  /**
   * Merge endpoint operations. Place the operations on the model
   * itself.
   */
  merge( options ) {
    this.idField = options.idField || 'id';
    this.attributes = fromJS( options.attributes || {} );
    this.relationships = fromJS( options.relationships || {} );
    this.indices = fromJS( options.indices || ['id'] );
    this.ops = {};
    this._makeRecord();

    // Build a list of all possible operations, then check if
    // it's been set in options.
    let operations = ['list', 'create', 'detail', 'update', 'remove'];
    for( const field of this.iterManyToMany() ) {
      operations.push( field + 'Add' );
      operations.push( field + 'Remove' );
    }
    for( const key of operations ) {
      if( key in options ) {
        this.ops[key] = (...args) => options[key]( ...args ).then( data => {
          console.debug( `Model: ${key}: `, data );
          return data;
        });
      }
    }
  }

  _makeRecord() {
    let data = {
      _type: undefined,
      [this.idField]: undefined
    };
    this.attributes.forEach( (attr, name) => {
      data[name] = attr.get( 'default' );
    });
    this.relationships.forEach( (rel, name) => {
      data[name] = rel.get( 'many' ) ? new OrderedSet() : undefined;
    });
    this._record = Record( data );
  }

  addReverseRelationship( field, relation ) {
    this.relationships = this.relationships.set( field, relation );
    this._makeRecord();
  }

  update( obj, values ) {
    Object.keys( values ).forEach( field => {
      obj = obj.set( field, values[field] );
    });
    return obj;
  }

  toObject( objData ) {
    let obj = new this._record( objData || {} );
    this.relationships.forEach( (rel, name) => {
      if( rel.get( 'many' ) ) {
        let val = obj.get( name );
        if( !OrderedSet.isOrderedSet( val ) && !Set.isSet( val ) )
          val = toArray( val );
        obj = obj.set( name, new OrderedSet(
          val.map( x => ID( x ) )
        ));
      }
      else if( obj[name] )
        obj = obj.set( name, ID( obj[name] ) );
    });
    return obj;
  }

  *iterFields() {
    yield '_type';
    yield 'id';
    for( const x of this.attributes.keys() )
      yield x;
    for( const x of this.iterRelationships() )
      yield x;
  }

  *iterRelationships() {
    for( const x of this.iterForeignKeys() )
      yield x;
    for( const x of this.iterManyToMany() )
      yield x;
  }

  *iterManyToMany() {
    for( const field of this.relationships.keys() ) {
      if( this.relationships.getIn( [field, 'reverse'] ) || !this.relationships.getIn( [field, 'many'] ) )
        continue;
      yield field;
    }
  }

  *iterForeignKeys() {
    for( const field of this.relationships.keys() ) {
      if( this.relationships.getIn( [field, 'reverse'] ) || this.relationships.getIn( [field, 'many'] ) )
        continue;
      yield field;
    }
  }

  diff( fromObject, toObject ) {
    let diff = {};

    // Check for creation.
    if( fromObject === undefined ) {
      if( toObject === undefined )
        return;
      for( const field of this.iterFields() ) {
        if( toObject[field] !== undefined )
          diff[field] = [undefined, toObject[field]];
      }
      return diff;
    }

    // Check for remove.
    else if( toObject === undefined ) {
      for( const field of this.iterFields() ) {
        if( fromObject[field] !== undefined )
          diff[field] = [fromObject[field], undefined];
      }
      return diff;
    }

    // Use field differences.
    else {
      let size = 0;
      for( const field of this.iterFields() ) {
        diff[field] = [fromObject[field], toObject[field]];
        if( field == '_type' || field == 'id' )
          continue;
        if( diff[field][0] == diff[field][1] )
          delete diff[field];
        else {
          const relInfo = this.relationships.get( field );
          if( relInfo ) {
            if( diff[field][0].equals( diff[field][1] ) )
              delete diff[field];
            else if( relInfo && relInfo.get( 'many' ) ) {
              size += 1;
              diff[field][0] = fromObject[field].subtract( toObject[field] );
              diff[field][1] = toObject[field].subtract( fromObject[field] );
            }
            else
              size += 1;
          }
          else
            size += 1;
        }
      }
      if( size )
        return diff;
    }
  }

  diffToJsonApi( diff ) {
    let data = {
      type: diff._type[1],
      id: diff.id[1],
      attributes: {},
      relationships: {}
    };
    const op = getDiffOp( diff );
    if( op == 'remove' ) {
      data.type = diff._type[0];
      data.id = diff.id[0];
    }
    for( const field of this.attributes.keys() ) {
      if( field in diff )
        data.attributes[field] = diff[field][1];
    }
    for( const field of this.iterForeignKeys() ) {
      if( field in diff ) {
        const x = diff[field][1];
        data.relationships[field] = {
          data: x ? {type: x._type, id: x.id} : null
        };
      }
    }
    return {data};
  }
}
