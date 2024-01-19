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
    delayWhen,
    mergeMap,
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
            upstream$: new BehaviorSubject([]),
            downstream$: new BehaviorSubject([]),
            users$: new BehaviorSubject([]),
            tools$: new BehaviorSubject([]),
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
            state$: new BehaviorSubject(null),
        };
        this.write = {
            meta$: new ReplaySubject(1),
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new ReplaySubject(1),
            state$: new ReplaySubject(1),
        };
        this.read = {
            meta$: new ReplaySubject(1),
            input$: new ReplaySubject(1),
            output$: new ReplaySubject(1),
            config$: new ReplaySubject(1),
            keys$: new BehaviorSubject(null),
            state$: new ReplaySubject(1),
        };
        this.status$ = new ReplaySubject(1);
        this.error$ = new ReplaySubject(1);
        this.log$ = new ReplaySubject(1);
        this.destroy$ = new Subject();
        this.ioReset$ = new Subject();

        this.rolesIO();
        this.initModules();

        if (start) {
            this.start();
        }

        Operable.$.next(this);
    }

    start() {
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
                    // console.log(
                    //     "PROCESS OPERATOR",
                    //     this.id,
                    //     operator?.toString()
                    // );
                    return this.read.input$.pipe(operator);
                })
            )
            .subscribe(this.write.output$);
    }

    rolesIO(fn) {
        const nonce = uuidv4();
        // console.log("ROLE IO", this.id, nonce, fn?.toString().length);
        fn ||= (key) => {
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
                    // tap(() => console.log(key, nonce, 'THIS SHOULDN"T BE HERE'))
                )
                .subscribe((data) => this.read[`${key}$`].next(data));
        };
        this.ioReset$.next(true);
        ["config", "keys", "input", "output", "meta", "state"].forEach(fn);
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
            combineLatest(input$, this.process.operator$).pipe(
                mergeMap(([input, operator]) => {
                    console.log(
                        "AS OPERATOR",
                        this.id,
                        input,
                        operator?.toString()
                    );
                    return of(input).pipe(operator);
                })
            );
    }

    connect(operable) {
        // console.log("CONNECT", this.id, operable.id);
        operable.io.upstream$.next(
            Array.from(new Set([...operable.io.upstream$.getValue(), this]))
        );
        this.io.downstream$.next(
            Array.from(new Set([...this.io.downstream$.getValue(), operable]))
        );
    }

    disconnect(operable) {
        operable.io.upstream$.next(
            operable.io.upstream$.getValue().filter((e) => e !== this)
        );
        this.io.downstream$.next(
            this.io.downstream$.getValue().filter((e) => e !== operable)
        );
    }

    use(operable) {
        operable.io.users$.next(
            Array.from(new Set([...operable.io.users$.getValue(), this]))
        );
        this.io.tools$.next(
            Array.from(new Set([...this.io.tools$.getValue(), operable]))
        );
    }

    remove(operable) {
        operable.io.users$.next(
            operable.io.users$.getValue().filter((e) => e !== this)
        );
        this.io.tools$.next(
            this.io.tools$.getValue().filter((e) => e !== operable)
        );
    }

    destroy() {
        this.destroy$.next(true);
    }

    async invokeAsFunction(input) {
        return await new Promise((resolve, reject) => {
            of(input)
                .pipe(
                    withLatestFrom(this.schema.input$),
                    map(([input, schema]) => schema.parse(input)),
                    tap((input) => console.log("INVOKE", this.id, input)),
                    this.process.operator$.getValue(),
                    take(1)
                )
                .subscribe({
                    next: resolve,
                    error: reject,
                });
        });
    }
}
