
import {html} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {store} from './store';
import test from './reducers/test';
import {showSnackbar} from './actions/test';
import {SambalApp} from './app';

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

class Test extends connect(store)(SambalApp) {

    constructor() {
        super(ROUTES);
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
            <switch-route path="/" @active="${() => {
                import('./view-one.js')
            }}">
                <view-one></view-one>
            </switch-route>
            <switch-route path="/two" @active="${() => {
                import('./view-two.js')
            }}">
                <view-two></view-two>
            </switch-route>
        `;
    }
    
}

customElements.define('my-test', Test);
