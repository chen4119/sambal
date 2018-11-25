import {LitElement} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {installRouter} from 'pwa-helpers/router.js';
import {store} from './store.js';
import {updateLocation} from './actions/app.js';

export default class SambalApp extends connect(store)(LitElement) {

    constructor() {
        super();
    }

    firstUpdated() {
        installRouter((location) => store.dispatch(updateLocation(location)));
        
        // Custom elements polyfill safe way to indicate an element has been upgraded.
        this.removeAttribute('unresolved');
    }

    static get properties() { 
        return {
            page: {type: String}
        }
    }

    stateChanged(state) {
        if (this.page !== state.app.page) {
            this.page = state.app.page;
        }
    }

    render() {
        const route = ROUTES.find((r) => r.path === this.page);
        return route.template;
    }
    
}