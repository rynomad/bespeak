import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

import "./icons/flip.mjs";
class FlipperComponent extends LitElement {
    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
        }

        :host(.front) {
            transform: rotateY(0deg);
        }

        :host(.back) {
            transform: rotateY(180deg);
        }

        .flip-icon.front {
            transform: rotateY(0deg);
            transition: transform 0.5s;
        }

        .flip-icon.back {
            transform: rotateY(180deg);
            transition: transform 0.5s;
        }
        .box {
            position: absolute;
            transform: translate(-50%, -50%);
            top: 50%;
            left: 50%;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            transition: width 0.5s, height 0.5s;
            overflow: hidden;
        }

        .element {
            backface-visibility: hidden;
            transition: transform 0.5s, opacity 0.5s 0.25s;
        }

        .front-mirror,
        .back-mirror {
            display: flex;
            justify-content: center; /* Center horizontally */
            align-items: center; /* Center vertically */
            transform: rotateY(0deg);
        }

        .beneath {
            z-index: -1;
        }

        .front-element {
            transform: rotateY(0deg);
        }

        .back-element {
            transform: rotateY(0deg);
        }

        .front-mirror {
            transform: rotateY(0deg);
        }

        .back-mirror {
            transform: scaleX(-1);
        }

        .transparent {
            opacity: 0;
            transition: opacity 0.25s;
        }
    `;
    constructor() {
        super();
        this.frontMirror = null;
        this.backMirror = null;
    }
    static get properties() {
        return {
            onToggle: { type: Function },
        };
    }

    toggle() {
        let targetSide;
        if (this.classList.contains("front")) {
            this.classList.remove("front");
            this.classList.add("back");
            targetSide = "back";
        } else {
            this.classList.remove("back");
            this.classList.add("front");
            targetSide = "front";
        }

        // Call the onToggle function if it's defined
        if (this.onToggle) {
            this.onToggle(targetSide);
        }
    }

    firstUpdated() {
        this.frontMirror = this.shadowRoot.querySelector(".front-mirror");
        this.backMirror = this.shadowRoot.querySelector(".back-mirror");

        const mirrorResizeObserver = new ResizeObserver(this.resize.bind(this));
        mirrorResizeObserver.observe(this.frontMirror);
        mirrorResizeObserver.observe(this.backMirror);

        const boxes = Array.from(this.shadowRoot.querySelectorAll(".box"));
        const resizeObserver = new ResizeObserver((entries) => {
            let maxWidth = 0;
            let maxHeight = 0;

            boxes.forEach((box) => {
                maxWidth = Math.max(maxWidth, box.offsetWidth);
                maxHeight = Math.max(maxHeight, box.offsetHeight);
            });

            this.style.width = `${maxWidth}px`;
            this.style.height = `${maxHeight}px`;
        });

        boxes.forEach((box) => {
            resizeObserver.observe(box);
        });

        const observer = new MutationObserver((mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "class"
                ) {
                    this.resize();
                }
            }
        });

        observer.observe(this, { attributes: true });
        this.resize();
    }

    transparent() {
        if (this.classList.contains("front")) {
            // remove transparent class from front slot
            this.shadowRoot
                .querySelector(".front-element")
                .classList.remove("transparent");
            // add transparent class to back slot
            this.shadowRoot
                .querySelector(".back-element")
                .classList.add("transparent");

            this.shadowRoot.querySelector(".back-box").classList.add("beneath");
            this.shadowRoot
                .querySelector(".front-box")
                .classList.remove("beneath");

            this.shadowRoot.querySelector(".flip-icon").classList.add("front");

            this.shadowRoot
                .querySelector(".flip-icon")
                .classList.remove("back");
        } else {
            // remove transparent class from back slot
            this.shadowRoot
                .querySelector(".back-element")
                .classList.remove("transparent");
            // add transparent class to front slot
            this.shadowRoot
                .querySelector(".front-element")
                .classList.add("transparent");

            this.shadowRoot.querySelector(".flip-icon").classList.add("back");

            this.shadowRoot
                .querySelector(".flip-icon")
                .classList.remove("front");

            this.shadowRoot
                .querySelector(".front-box")
                .classList.add("beneath");
            this.shadowRoot
                .querySelector(".back-box")
                .classList.remove("beneath");
        }
    }

    resize() {
        const target = this.classList.contains("front")
            ? this.shadowRoot.querySelector(
                  ".front-box > .element > :first-child"
              )
            : this.shadowRoot.querySelector(
                  ".back-box > .element > :first-child"
              );

        const boxes = Array.from(this.shadowRoot.querySelectorAll(".box"));
        boxes.forEach((box) => {
            box.style.setProperty("width", `${target.clientWidth}px`);
            box.style.setProperty("height", `${target.clientHeight}px`);
        });

        this.transparent();
    }

    render() {
        return html`
            <div class="container">
                <div class="box front-box">
                    <div class="element front-element">
                        <div class="front-mirror">
                            <slot name="front"></slot>
                        </div>
                    </div>
                </div>
                <div class="box back-box">
                    <div class="element back-element">
                        <div class="back-mirror">
                            <slot name="back"></slot>
                        </div>
                    </div>
                </div>
                <div class="flip-icon">
                    <bespeak-flip-icon
                        @click="${this.toggle}"
                        style="position: absolute; top: 5px; right: 5px;"></bespeak-flip-icon>
                </div>
            </div>
        `;
    }
}

customElements.define("bespeak-flipper", FlipperComponent);
