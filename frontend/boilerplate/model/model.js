require( 'babel-polyfill' );

import { Set, Record, fromJS } from 'immutable';
import uuid from 'uuid';

import { toArray } from './utils';

export default class Model {

  constructor( type ) {
    this.type = type;
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
    this.idField = options.idField || 'id';
    this.attributes = fromJS( options.attributes || {} );
    this.relationships = fromJS( options.relationships || {} );
    this.indices = fromJS( options.indices || ['id'] );
    this._makeRecord();
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
      data[name] = rel.get( 'many' ) ? new Set() : undefined;
    });
    this._record = Record( data );
  }

  addReverseRelationship( field, relation ) {
    this.relationships = this.relationships.update( field, relation );
    this._makeRecord();
  }

  toObject( objData ) {
    let obj = new this._record( objData || {} );
    this.relationships.forEach( (rel, name) => {
      const val = obj.get( name );
      if( rel.get( 'many' ) && !Set.isSet( val ) )
        obj = obj.set( name, new Set( toArray( val ) ) );
    });
    return obj;
  }
}
