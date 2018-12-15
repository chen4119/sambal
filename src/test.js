
import {html} from '@polymer/lit-element';
import {SambalApp} from './app';


class Test extends SambalApp {

    constructor() {
        super();
    }

    render() {
        return html`
            <h1>hello world</h1>
            ${this.page}
        `;
    }
    
}

customElements.define('my-test', Test);
