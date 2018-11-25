import {
    createStore,
    applyMiddleware,
    compose,
    combineReducers
} from 'redux';
import thunk from 'redux-thunk';
import { lazyReducerEnhancer } from 'pwa-helpers/lazy-reducer-enhancer.js';
import app from './reducers/app.js';

export const store = createStore(
    (state, action) => state,
    compose(lazyReducerEnhancer(combineReducers), applyMiddleware(thunk))
);

store.addReducers({
    app
});