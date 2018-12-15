import {LitElement} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {installRouter} from 'pwa-helpers/router.js';
import {installMediaQueryWatcher} from 'pwa-helpers/media-query.js';
import {store} from './store.js';
import {updateLocation} from './actions/app.js';

export class SambalApp extends connect(store)(LitElement) {

    constructor(smallScreenWidth = 767) {
        super();
        this.smallScreenWidth = smallScreenWidth;
    }

    firstUpdated() {
        installRouter((location) => store.dispatch(updateLocation(location)));
        installMediaQueryWatcher(`(max-width: ${this.smallScreenWidth}px)`, (matches) => this.isSmallScreen = matches);

        // Custom elements polyfill safe way to indicate an element has been upgraded.
        this.removeAttribute('unresolved');
    }

    static get properties() { 
        return {
            page: {type: String},
            isSmallScreen: {type: Boolean}
        }
    }

    stateChanged(state) {
        if (this.page !== state.app.page) {
            this.page = state.app.page;
        }
    }
}