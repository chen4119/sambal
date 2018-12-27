import {html, LitElement} from '@polymer/lit-element';
import {connect} from 'pwa-helpers/connect-mixin.js';
import {store} from './store';

export class Route extends connect(store)(LitElement) {

    constructor() {
        super();
        this.isActive = false;
    }

    static get properties() { 
        return {
            path: {type: String},
            isActive: {type: Boolean}
        }
    }

    stateChanged(state) {
        const currentPath = state.sambal.path;
        if (this.isActive && this.path !== currentPath) {
            this.isActive = false;
        } else if (!this.isActive && this.path === currentPath) {
            this.isActive = true;
            this.dispatchEvent(new CustomEvent('active'));
        }
    }

    render() {
        if (this.isActive) {
            return html`<slot></slot>`;
        }
        return html``;
    }
}

customElements.define('switch-route', Route);