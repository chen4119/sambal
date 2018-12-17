import {LitElement} from '@polymer/lit-element';
import {installRouter} from 'pwa-helpers/router.js';
import {installMediaQueryWatcher} from 'pwa-helpers/media-query.js';
import {store} from './store.js';
import {updateLocation, updateScreenSize} from './actions/sambal.js';

export class SambalApp extends LitElement {

    constructor(routes, smallScreenWidth = 767) {
        super();
        this.routeMap = new Map();
        for (let i = 0; i < routes.length; i++) {
            this.routeMap.set(routes[i].path, routes[i]);
        }
        this.smallScreenWidth = smallScreenWidth;
    }

    firstUpdated() {
        installRouter((location) => {
            const path = decodeURIComponent(location.pathname);
            store.dispatch(updateLocation(path));
            if (this.routeMap.has(path)) {
                const route = this.routeMap.get(path);
                if (route.dispatch) {
                    store.dispatch(route.dispatch);
                }
            }
        });
        installMediaQueryWatcher(`(max-width: ${this.smallScreenWidth}px)`, (matches) => store.dispatch(updateScreenSize(matches)));

        // Custom elements polyfill safe way to indicate an element has been upgraded.
        this.removeAttribute('unresolved');
    }

    getRoute(path) {
        return this.routeMap.get(path);
    }

}