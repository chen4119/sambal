
import {html, LitElement} from '@polymer/lit-element';
import {installRouter} from 'pwa-helpers/router.js';
import {installMediaQueryWatcher} from 'pwa-helpers/media-query.js';
import {updateLocation, updateScreenSize} from './actions/sambal.js';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {store} from './store';
import test from './reducers/test';
import {showSnackbar} from './actions/test';
import('./view-one.js');
import('./view-two.js');
import('./switch-route');

const ROUTES = [
    {
        path: '/',
        import: 'view-one'
    },
    {
        path: '/test'
    }
];

store.addReducers({
    test
});

class Test extends connect(store)(LitElement) {

    constructor() {
        super();
    }

    firstUpdated() {
        console.log('first updated');
        installRouter((location) => {
            const path = decodeURIComponent(location.pathname);
            console.log('dispatch location ' + path);
            store.dispatch(updateLocation(path));
        });
        installMediaQueryWatcher(`(max-width: ${this.smallScreenWidth}px)`, (matches) => store.dispatch(updateScreenSize(matches)));

        // Custom elements polyfill safe way to indicate an element has been upgraded.
        this.removeAttribute('unresolved');
    }

    static get properties() { 
        return {
            path: {type: String},
            isSmallScreen: {type: Boolean}
        }
    }

    stateChanged(state) {
        if (this.path !== state.sambal.path) {
            this.path = state.sambal.path;
        }
        if (this.isSmallScreen !== state.sambal.isSmallScreen) {
            this.isSmallScreen = state.sambal.isSmallScreen;
        }
    }

    render() {
        return html`
            <h1>Hello world</h1>
            <a href='/'>home</a>
            <a href='/two'>two</a>
            <switch-route path="/">
                <view-one></view-one>
            </switch-route>
            <switch-route path="/two">
                <view-two></view-two>
            </switch-route>
        `;
    }
    
}

customElements.define('my-test', Test);
