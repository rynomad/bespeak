import { of, catchError } from "https://esm.sh/rxjs";
import { switchMap } from "https://esm.sh/rxjs/operators";
import { v4 as uuidv4 } from "https://esm.sh/uuid";
import isPojo from "https://esm.sh/is-pojo";
import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

function createProxy(resolveFn, path = "") {
    let proxy = null;
    // console.log("createProxy", resolveFn, path);
    const handler = {
        get(target, prop) {
            try {
                if (!prop) {
                    console.log("NO PROP");
                    return target;
                }
                if (
                    prop === "then" ||
                    prop === "catch" ||
                    prop === "finally" ||
                    prop === Symbol.toStringTag
                ) {
                    console.log(
                        "THENABLE",
                        !!path,
                        `[${path}]`,
                        path.split(".").length,
                        prop
                    );

                    if (path.split(".").length === 1) {
                        return Promise.resolve(target);
                    }

                    let promise = resolveFn({ path, action: "get" });

                    if (!promise.then) {
                        promise = Promise.resolve(promise);
                    }

                    if (typeof promise[prop] === "function") {
                        return promise[prop].bind(promise);
                    } else {
                        return promise[prop];
                    }
                }

                if (typeof prop === "string") {
                    console.log("get", path, prop);
                    return createProxy(resolveFn, `${path}.${prop}`);
                }

                return target[prop].bind(target);
            } catch (e) {
                console.log("get error", path, prop, e);
                return target[prop];
            }
        },
        apply(_target, _thisArg, args) {
            // If the proxy is invoked as a function, resolve with the 'apply' action.
            return resolveFn({ path, action: "apply", args });
        },
    };

    proxy = new Proxy(() => {}, handler);

    return proxy;
}

const proxy = createProxy(async ({ path, action }) => {
    // Trim the initial dot from the path
    const formattedPath = path.substring(1);
    await new Promise((r) => setTimeout(r, 1000));
    return Promise.resolve(
        action === "apply" ? "foo " + formattedPath : "bar " + formattedPath
    );
});

// Usage examples
(async () => {
    console.log("runnning");
    console.log(await proxy.some.deep.path.and.stuff); // bar some.deep.path
    console.log(await proxy.some.other.path()); // foo some.other.path
    console.log("ran");
})();

class RPCServer {
    static objects = new Map();
    constructor(object, id = uuidv4()) {
        console.log("RPCServer", id, object);
        this.id = id;
        RPCServer.objects.set(this.id, object);
    }

    static async _handle({ id, path, action, args }) {
        const object = RPCServer.objects.get(id);
        console.log("_handle", id, path, action, args, object);
        if (!path) {
            return { object: id };
        }
        const pathParts = path.split(".");
        try {
            let result = object;
            for (const part of pathParts) {
                console.log("part", part);
                result = result[part].bind?.(result);
            }
            if (action === "apply") {
                result = await result(...args);
            }
            return result;
        } catch (e) {
            return "Error: " + e.message;
        }
    }

    static async handle({ id, path, action, args = [] }) {
        console.log("handle", id, path, action, args);
        args = args.map((arg) => {
            if (typeof arg === "object" && arg.object) {
                return restoreFromRPCServerRefs(arg);
            } else if (typeof arg === "object" && arg.callback) {
                return (...args) => {
                    this.callback(arg.callback, cloneWithRPCServerRefs(args));
                };
            }
            return arg;
        });

        const result = await this._handle({ id, path, action, args });
        console.log("result", result);
        return cloneWithRPCServerRefs(result);
    }

    static callback(callback, args) {
        this.transport.send({ callback, args });
    }

    static useTransport(transport) {
        this.transport = transport;
        transport.handle(this.handle.bind(this));
    }

    connected(callback) {
        console.log("connected", this.transport.connected);
        this.transport.connected(callback);
    }
}

class RPCClient {
    static callbacks = new Map();
    static requestQueue = [];
    static serverReady = false;

    static create(id) {
        console.log("CREATE");
        return createProxy(this.handle.bind(this), id);
    }

    static async handle({ action, path, args = [] }) {
        const [id, ...pathParts] = path.split(".");
        path = pathParts.join(".");

        args = args.map((arg) => {
            if (typeof arg === "function") {
                const id = uuidv4();
                this.callbacks.set(id, arg);
                return { callback: id };
            }
            return arg;
        });

        if (this.serverReady) {
            return new Promise((resolve, reject) =>
                this.sendRequest({ id, path, action, args, resolve, reject })
            );
        } else {
            // Otherwise, add it to the queue to be sent later
            return new Promise((resolve, reject) => {
                this.requestQueue.push({
                    id,
                    path,
                    action,
                    args,
                    resolve,
                    reject,
                });
            });
        }
    }

    static async sendRequest({ id, path, action, args, resolve, reject }) {
        try {
            const result = await this.transport.request({
                id,
                path,
                action,
                args,
            });
            resolve(hydrateClientsFromServer(result));
        } catch (error) {
            reject(error);
        }
    }

    static useTransport(transport) {
        this.transport = transport;
        transport.handle(({ callback, args = [] }) => {
            if (!callback) {
                return;
            }
            const callbackFn = this.callbacks.get(callback);
            console.log("callback", callback, callbackFn, args);
            if (callbackFn) {
                callbackFn(...hydrateClientsFromServer(args));
            }
        });

        transport.addEventListener("ready", () => {
            this.serverReady = true;
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                this.sendRequest(request);
            }
        });
    }

    static connected(callback) {
        console.log("connected", this.transport.connected);
        this.transport.connected(callback);
    }
}

function cloneWithRPCServerRefs(obj) {
    if (isPojo(obj) && !Array.isArray(obj)) {
        const clone = {};
        for (const key in obj) {
            clone[key] = cloneWithRPCServerRefs(obj[key]);
        }
        return clone;
    } else if (Array.isArray(obj)) {
        return obj.map(cloneWithRPCServerRefs);
    } else if (typeof obj === "object" && obj !== null) {
        const server = new RPCServer(obj);
        return { object: server.id };
    } else {
        return obj;
    }
}

function restoreFromRPCServerRefs(clone) {
    if (isPojo(clone) && !Array.isArray(clone) && !clone.object) {
        const obj = {};
        for (const key in clone) {
            obj[key] = restoreFromRPCServerRefs(clone[key]);
        }
        return obj;
    } else if (Array.isArray(clone)) {
        return clone.map(restoreFromRPCServerRefs);
    } else if (typeof clone === "object" && clone !== null && clone.object) {
        const server = RPCServer.objects.get(clone.object);
        return server;
    } else {
        return clone;
    }
}

function hydrateClientsFromServer(clone) {
    if (isPojo(clone) && !Array.isArray(clone) && !clone.object) {
        const obj = {};
        for (const key in clone) {
            obj[key] = hydrateClientsFromServer(clone[key]);
        }
        return obj;
    } else if (Array.isArray(clone)) {
        return clone.map(hydrateClientsFromServer);
    } else if (typeof clone === "object" && clone !== null && clone.object) {
        console.log("hydrateClientsFromServer", clone);
        return RPCClient.create(clone.object);
    } else {
        return clone;
    }
}

class Transport extends EventTarget {
    constructor() {
        super();
        if (new.target === Transport) {
            throw new TypeError(
                "Cannot construct Transport instances directly"
            );
        }
    }

    // These methods should be implemented by subclasses
    async send() {
        throw new Error("Method 'send' not implemented");
    }

    async request() {
        throw new Error("Method 'request' not implemented");
    }

    handle() {
        throw new Error("Method 'handle' not implemented");
    }

    serverReady() {
        this.dispatchEvent(new Event("ready"));
    }
}

class MessageChannelTransport extends Transport {
    constructor(port, name = "MessageChannelTransport") {
        super();
        this.name = name;
        this.port = port;
        this.requests = new Map();
        this.port.onmessage = this._handleMessage.bind(this);
    }

    async send(data) {
        this.port.postMessage(data);
    }

    async request(data) {
        return new Promise((resolve) => {
            const id = uuidv4();
            this.requests.set(id, resolve);
            this.port.postMessage({ request: id, ...data });
        });
    }

    handle(callback) {
        this.callback = callback;
    }

    async _handleMessage(event) {
        console.log(this.name, "message", event.data, this.requests);
        const data = event.data;
        if (this.requests.has(data.request)) {
            console.log("got response", data);
            const resolve = this.requests.get(data.request);

            resolve(data.result);
            this.requests.delete(data.request);
        } else if (this.callback) {
            const result = await this.callback(data);
            console.log("callback result", result);
            if (result) {
                this.send({ id: data.id, request: data.request, result });
            }
        }
    }
}

const channel = new MessageChannel();
const port1 = channel.port1;
const port2 = channel.port2;

RPCServer.useTransport(new MessageChannelTransport(port1, "server"));

const test = {
    some: {
        deep: {
            prop: "value",
            fn: (cb) => {
                setTimeout(() => cb("deep fn"), 1000);
                return "some return value";
            },
        },
    },
};

class WebSocketServerTransport extends Transport {
    constructor(port) {
        super();
        this.port = port;
        this.requests = new Map();
        this.server = new WebSocketServer(port);
        console.log("construct server");
        this.server.on("connection", (socket) => {
            console.log("server got connection");
            this.serverReady();
            socket.on("message", async (message) => {
                const data = JSON.parse(message);
                if (this.requests.has(data.request)) {
                    const resolve = this.requests.get(data.request);
                    resolve(data.result);
                    this.requests.delete(data.request);
                } else if (this.callback) {
                    const result = await this.callback(data);
                    console.log("callback result", result);
                    if (result) {
                        this.send({
                            id: data.id,
                            request: data.request,
                            result,
                        });
                    }
                }
            });
        });
    }

    async send(data) {
        this.server.clients.forEach((client) => {
            client.send(JSON.stringify(data));
        });
    }

    async request(data) {
        return new Promise((resolve) => {
            const id = uuidv4();
            this.requests.set(id, resolve);
            this.send({ request: id, ...data });
        });
    }

    handle(callback) {
        this.callback = callback;
    }

    connected(callback) {
        console.log("set connected callback");
        this.server.on("connection", callback);
    }
}

export const key = "logseq";
export const version = "0.0.1";
export const description =
    "Executes a function string with a logseq object in scope.";

export const inputSchema = () =>
    of({
        type: "object",
        properties: {
            functionString: {
                type: "string",
                description:
                    "The function string to be executed. It is executed with a logseq object in scope. It is executed via the Function constructor, so if you want to return a value, you must use the return keyword.",
            },
        },
        required: ["functionString"],
        additionalProperties: false,
    });

export const outputSchema = () =>
    of({
        type: "object",
        additionalProperties: true,
    });

let _transport = null;
const executeFunction = ({ node, config, keys }) => {
    const transport = _transport || new WebSocketServerTransport(9999);
    _transport = transport;
    RPCClient.useTransport(transport);
    const logseq = RPCClient.create("logseq");
    return (input$) =>
        input$.pipe(
            switchMap(async ({ functionString }) => {
                const func = new Function("logseq", functionString);
                const result = await func(logseq);
                return { result };
            }),
            catchError((error) => {
                return {
                    error: `Error: ${error}`,
                };
            })
        );
};

export default executeFunction;
