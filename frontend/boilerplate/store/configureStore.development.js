import { createStore, applyMiddleware, compose } from 'redux'
import { persistState } from 'redux-devtools'
import thunk from 'redux-thunk'
import { browserHistory } from 'react-router'
import { routerMiddleware } from 'react-router-redux'
import rootReducer from 'reducers'
import DevTools from '../components/dev-tools'

const enhancer = compose(
    applyMiddleware( thunk, routerMiddleware( browserHistory ) ),
    DevTools.instrument(),
    persistState(
        window.location.href.match(
            /[?&]debug_session=([^&]+)\b/
        )
    )
);

export default function configureStore( initialState ) {
    const store = createStore( rootReducer, initialState, enhancer );

    /* router.listenForReplays( store ); */

    if( module.hot ) {
        module.hot.accept( 'reducers', () =>
            store.replaceReducer( require( 'reducers' ) )
        );
    }

    return store;
}
