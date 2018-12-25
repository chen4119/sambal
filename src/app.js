import {LitElement} from '@polymer/lit-element';
import {installRouter} from 'pwa-helpers/router.js';
import {installMediaQueryWatcher} from 'pwa-helpers/media-query.js';
import {store} from './store.js';
import {updateLocation, updateScreenSize} from './actions/sambal.js';
import './route';

export class SambalApp extends LitElement {

    constructor(smallScreenWidth = 767) {
        super();
        this.smallScreenWidth = smallScreenWidth;
    }

    firstUpdated() {
        installRouter((location) => {
            const path = decodeURIComponent(location.pathname);
            store.dispatch(updateLocation(path));
        });
        installMediaQueryWatcher(`(max-width: ${this.smallScreenWidth}px)`, (matches) => store.dispatch(updateScreenSize(matches)));

        // Custom elements polyfill safe way to indicate an element has been upgraded.
        this.removeAttribute('unresolved');
    }
}