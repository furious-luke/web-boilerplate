import { Map } from 'immutable';

import Model from './model';

export class Schema {

  constructor( descr={} ) {
    this.models = new Map();
    this.merge( descr );
  }

  merge( descr={} ) {
    for( const type of Object.keys( descr ) ) {
      let model = this.getModel( type );
      if( model === undefined )
        model = new Model( type );
      model.merge( descr[type] );
      this.models = this.models.set( type, model );
    }
    this._updateReverseRelationships();
  }

  _updateReverseRelationships() {
    this.models.forEach( (model, name) => {
      model.relationships.forEach( (relDescr, field) => {
        if( !relDescr.has( 'relatedName' ) || !relDescr.has( 'type' ) || relDescr.get( 'reverse' ) )
          return;
        let relModel = this.getModel( relDescr.get( 'type' ) );
        relModel.addReverseRelationship( relDescr.get( 'relatedName' ), new Map({
          type: model.type,
          relatedName: field,
          reverse: true,
          many: true
        }));
        this.models = this.models.set( relModel.type, relModel );
      });
    });
  }

  getModel( type ) {
    return this.models.get( type );
  }

  toObjects( data ) {
    return data.map( objData => this.toObject( objData ) );
  }

  toObject( data ) {
    const model = this.getModel( data._type );
    return model.toObject( data );
  }

        /* calcDiffs( state ) {
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
           } */
}

let schema = new Schema();

export default schema;
