class Model {

  constructor( type ) {
    this.type = type;
  }

  merge( options ) {
    for( const key of [ 'list', 'create', 'detail' ] ) {
      if( key in options ) {
        this[key] = (...args) => options[key]( ...args ).then( data => {
          console.debug( `Model: ${key}: `, data );
          const res = this.fromJsonApi( data );
          console.debug( `Model: ${key}: `, res );
          return res;
        });
        this[key].type = this.type;
      }
    }
  }

  modelFromJsonApi( object ) {
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
  }

  static calcDiff( state, type, id ) {
    const serverModel = getServer( state, type, id );
    const localModel = getLocal( state, type, id );

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
        changedFields.push( localField );
    }
    if( changedFields.length ) {
      return {
        op: 'updated',
        model: localModel,
        fields: updatedFields
      };
    }

    return false;
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
