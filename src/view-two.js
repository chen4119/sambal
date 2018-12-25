import {html, LitElement} from '@polymer/lit-element';

export class ViewTwo extends LitElement {

    constructor() {
        super();
    }

    render() {
        return html`<h1>Showing view 2</h1>`;
    }
}

customElements.define('view-two', ViewTwo);