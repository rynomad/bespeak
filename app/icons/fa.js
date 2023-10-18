import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { facss } from "./fa.css.js";

class FaIcon extends LitElement {
    static styles = [
        facss,
        css`
            :host {
                display: inline-block;
                font-size: var(--icon-size, 1em);
            }
            i {
                display: inline-block;
                width: 1em;
                height: 1em;
                line-height: 1em;
                text-align: center;
            }
            .spin-z {
                animation: spin-z 2s linear infinite;
            }
            .spin-y {
                perspective: 400px;
                animation: spin-y 2s linear infinite;
            }
            .ripple {
                animation: ripple 1.5s ease-in-out infinite;
            }
            @keyframes spin-z {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
            @keyframes spin-y {
                from {
                    transform: rotateY(0deg);
                }
                to {
                    transform: rotateY(360deg);
                }
            }
            @keyframes ripple {
                0%,
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 0.5;
                }
            }
        `,
    ];

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("size")) {
            this.style.setProperty("--icon-size", this.size);
        }
    }

    static get properties() {
        return {
            icon: { type: String },
            size: { type: String },
            animation: { type: String },
        };
    }

    render() {
        const classes = `${this.icon} fa-${
            this.size
        } ${this.getAnimationClass()}`;
        return html` <i class="${classes}"></i> `;
    }

    getAnimationClass() {
        switch (this.animation) {
            case "spin-z":
                return "spin-z";
            case "spin-y":
                return "spin-y";
            case "ripple":
                return "ripple";
            default:
                return "";
        }
    }
}

customElements.define("fa-icon", FaIcon);
