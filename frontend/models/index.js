import {schema} from 'redux-jam';
import api from 'api';

schema.merge( require( './models.json' ) );

export default schema;
