import {html, LitElement} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {store} from './store';

export class Route extends connect(store)(LitElement) {

    constructor() {
        super();
        this.isActive = false;
    }

    shouldUpdate() {
        return this.isActive;
    }

    static get properties() { 
        return {
            path: {type: String},
            isActive: {type: Boolean}
        }
    }

    async stateChanged(state) {
        const currentPath = state.sambal.path;
        if (this.isActive && this.path !== currentPath) {
            this.isActive = false;
        } else if (!this.isActive && this.path === currentPath) {
            this.isActive = true;
            this.dispatchEvent(new CustomEvent('active'));
        }
    }

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define('switch-route', Route);