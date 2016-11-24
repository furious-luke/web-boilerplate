import { createAction, postForm, csrfSettings } from './utils';

const setModel = createAction( 'MODEL_SET' );
const loadModels = createAction( 'MODEL_LOAD' );
const loadModelView = createAction( 'MODEL_LOAD_VIEW' );
