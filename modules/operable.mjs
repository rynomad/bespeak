import {
    filter,
    BehaviorSubject,
    switchMap,
    of,
    withLatestFrom,
    take,
    map,
    combineLatest,
    ReplaySubject,
    distinctUntilChanged,
} from "https://esm.sh/rxjs@7.8.1";

import { v4 as uuidv4 } from "https://esm.sh/uuid";
import { tap } from "npm:rxjs@^7.8.1";
import { deepEqual } from "https://esm.sh/fast-equals";

export default class Operable {
    constructor(id = uuidv4()) {
        // Initialize interfaces
        this.id = id;
        this.meta$ = new BehaviorSubject(null);
        this.process = {
            module$: new BehaviorSubject(null),
            operator$: new BehaviorSubject(null),
        };
        this.ingress = {
            module$: new BehaviorSubject(null),
            operator$: new BehaviorSubject(null),
        };
        this.io = {
            upstream$: new BehaviorSubject(null),
            downstream$: new BehaviorSubject(null),
            users$: new BehaviorSubject(null),
            tools$: new BehaviorSubject(null),
        };
        this.schema = {
            input$: new BehaviorSubject(null),
            output$: new BehaviorSubject(null),
            config$: new BehaviorSubject(null),
            keys$: new BehaviorSubject(null),
        };
        this.write = {
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new ReplaySubject(1),
        };
        this.read = {
            input$: new BehaviorSubject(null),
            output$: new BehaviorSubject(null),
            config$: new BehaviorSubject(null),
            keys$: new BehaviorSubject(null),
        };
        this.status$ = new BehaviorSubject(null);
        this.log$ = new BehaviorSubject(null);

        this.initModules();
        this.initPipelines();
    }

    initModules() {
        ["process", "ingress"].forEach((key) => {
            this[key].module$
                .pipe(
                    filter((module) => module?.default),
                    map((module) => module.default(this)),
                    tap((operator) =>
                        console.log("operator", operator, "key", key)
                    )
                )
                .subscribe(this[key].operator$);
        });

        ["input", "output", "config", "keys"].forEach((key) => {
            this.process.module$
                .pipe(
                    filter((module) => module?.[key]),
                    switchMap((module) => module[key](this))
                )
                .subscribe(this.schema[`${key}$`]);
        });
    }

    initPipelines() {
        this.ingress.operator$
            .pipe(
                filter((operator) => operator),
                switchMap((operator) => operator)
            )
            .subscribe(this.write.input$);

        this.process.operator$
            .pipe(
                filter((operator) => operator),
                switchMap((operator) => {
                    return this.read.input$.pipe(operator);
                })
            )
            .subscribe(this.write.output$);

        ["config", "keys", "input", "output"].forEach((key) => {
            combineLatest(this.write[`${key}$`], this.schema[`${key}$`])
                .pipe(
                    map(([data, schema]) =>
                        schema?.parse ? schema.parse(data) : data
                    ),
                    distinctUntilChanged(deepEqual)
                )
                .subscribe(this.read[`${key}$`]);
        });
    }

    // RxJS interoperability functions
    pipe(...args) {
        return this.read.output$.pipe(
            ...args.map((arg) => (arg.asOperator ? arg.asOperator() : arg))
        );
    }

    subscribe(observer) {
        return this.read.output$.subscribe(observer);
    }

    next(value) {
        this.write.input$.next(value);
    }

    asOperator() {
        return this.process.operator.getValue();
    }

    async invokeAsFunction(input) {
        return await new Promise((resolve, reject) => {
            of(input)
                .pipe(
                    withLatestFrom(this.schema.input$),
                    map(([input, schema]) => schema.parse(input)),
                    this.asOperator(),
                    take(1)
                )
                .subscribe({
                    next: resolve,
                    error: reject,
                });
        });
    }
}
