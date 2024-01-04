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
    tap,
    takeUntil,
    Subject,
} from "https://esm.sh/rxjs@7.8.1";

import { v4 as uuidv4 } from "https://esm.sh/uuid";
import { deepEqual } from "https://esm.sh/fast-equals";
import { z } from "https://esm.sh/zod@3.22.4";

export default class Operable {
    static $ = new ReplaySubject(1);

    constructor(id = uuidv4(), start = true) {
        // Initialize interfaces
        this.id = id;
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
            meta$: new BehaviorSubject(
                z.object({
                    id: z.string().default(id),
                    name: z.string().optional(),
                    description: z.string().optional(),
                    ingress: z.string().default("default-ingress@0.0.1"),
                    process: z.string().default("gpt@0.0.1"),
                })
            ),
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new ReplaySubject(1),
        };
        this.write = {
            meta$: new ReplaySubject(1),
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new ReplaySubject(1),
        };
        this.read = {
            meta$: new ReplaySubject(1),
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new BehaviorSubject(null),
        };
        this.status$ = new ReplaySubject(1);
        this.error$ = new ReplaySubject(1);
        this.log$ = new ReplaySubject(1);
        this.destroy$ = new Subject();
        this.ioReset$ = new Subject();

        Operable.$.next(this);
        this.rolesIO();
        if (start) {
            this.start();
        }
    }

    start() {
        this.initModules();
        this.initPipelines();
    }

    stop() {
        this.destroy$.next();
    }

    initModules() {
        ["process", "ingress"].forEach((key) => {
            this[key].module$
                .pipe(
                    filter((module) => module?.default),
                    map((module) => module.default(this))
                )
                .subscribe(this[key].operator$);
        });
        ["input", "output", "config", "keys"].forEach((key) => {
            this.process.module$
                .pipe(
                    filter((module) => module),
                    switchMap((module) => {
                        if (module[key]) {
                            return module[key](this);
                        } else {
                            return of(z.any());
                        }
                    })
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
    }

    rolesIO(
        fn = (key) => {
            combineLatest(this.write[`${key}$`], this.schema[`${key}$`])
                .pipe(
                    map(([data, schema]) =>
                        schema?.parse
                            ? schema.safeParse(data)
                            : { success: true, data }
                    ),
                    map((res) => (res.success ? res.data : null)),
                    filter((data) => !!data),
                    distinctUntilChanged(deepEqual),
                    takeUntil(this.ioReset$)
                )
                .subscribe(this.read[`${key}$`]);
        }
    ) {
        this.ioReset$.next();
        ["config", "keys", "input", "output", "meta"].forEach(fn);
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
        return (input$) =>
            combineLatest(
                input$,
                this.process.operator$.pipe(filter((e) => e))
            ).pipe(switchMap(([input, operator]) => of(input).pipe(operator)));
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
