import {html, LitElement} from '@polymer/lit-element';

export class ViewOne extends LitElement {

    constructor() {
        super();
    }

    render() {
        return html`<h1>Showing view 1</h1>`;
    }
}

customElements.define('view-one', ViewOne);