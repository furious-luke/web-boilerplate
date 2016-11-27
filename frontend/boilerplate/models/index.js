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
      this[key] = model
    }
  }
}

let schema = new Schema();

export default schema;
