
import {html} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {store} from './store';
import test from './reducers/test';
import {showSnackbar} from './actions/test';
import {SambalApp} from './app';

const ROUTES = [
    {
        path: '/',
        template: html`<h1>On Main page<h1>`
    },
    {
        path: '/test',
        template: html`<h1>On Test page<h1>`,
        dispatch: showSnackbar()
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
        console.log(state);
        if (this.path !== state.sambal.path) {
            this.path = state.sambal.path;
        }
        if (this.isSmallScreen !== state.sambal.isSmallScreen) {
            this.isSmallScreen = state.sambal.isSmallScreen;
        }
    }

    render() {
        const route = this.getRoute(this.path);
        return route.template;
    }
    
}

customElements.define('my-test', Test);
