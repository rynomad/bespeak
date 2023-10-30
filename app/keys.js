import { ReteNode } from "./node.child.js";
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import localForage from "https://esm.sh/localforage";
import { getDefaultValue } from "./util.js";
import { repeat } from "https://esm.sh/lit/directives/repeat.js";
import { BehaviorSubject } from "https://esm.sh/rxjs";

export class Keys extends LitElement {
    static get styles() {
        return css`
            :host {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
            }
        `;
    }

    static get properties() {
        return {
            keySets: { type: Array },
        };
    }

    static keysDB = localForage.createInstance({
        name: "bespeak-keys",
    });

    static async getKeys(Component) {
        return await Keys.keysDB.getItem(Component.tagName);
    }

    static keysUpdated$ = new BehaviorSubject();

    constructor() {
        super();
        this.keySets = [];
        ReteNode.components$.subscribe(async (components) => {
            this.keySets = await Promise.all(
                components
                    .filter(({ Component }) => Component.keys)
                    .map(async ({ Component }) => {
                        const keys =
                            (await Keys.getKeys(Component)) ||
                            getDefaultValue(Component.keys);
                        return {
                            Component,
                            keys,
                        };
                    })
            );
        });
    }

    render() {
        return html`${repeat(
            this.keySets,
            ({ Component }) => Component.tagName,
            ({ Component, keys }) => html`<bespeak-form
                .onChange=${async (event) => {
                    this.keySets = this.keySets.map((keySet) => {
                        if (keySet.Component === Component) {
                            return {
                                ...keySet,
                                keys: event.formData,
                            };
                        }
                        return keySet;
                    });
                    await Keys.keysDB.setItem(
                        Component.tagName,
                        event.formData
                    );
                    Keys.keysUpdated$.next();
                }}
                .props=${{
                    name: Component.title,
                    schema: Component.keys,
                    uiSchema: Object.keys(
                        Component.keys.properties || {}
                    ).reduce((uiSchema, key) => {
                        uiSchema[key] = {
                            "ui:widget": "password",
                        };
                        return uiSchema;
                    }, {}),
                    formData: keys,
                }}></bespeak-form>`
        )}`;
    }
}

customElements.define("bespeak-keys", Keys);
