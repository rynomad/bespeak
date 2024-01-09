import { BehaviorSubject, combineLatest, of, Subject, tap, withLatestFrom } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { z } from 'zod';

export const key = "FlowConstructor";
export const version = "1.0.0";
export const description = "This operator encapsulates a flow of other operables.";

export const configSchema = () => {
  const schema = z.object({
    operables: z.array(z.string()).nonempty(),
    connections: z.object({
      stream: z.array(z.object({
        to: z.string(),
        from: z.string(),
      })),
      tools: z.array(z.object({
        to: z.string(),
        from: z.string(),
      })),
    }),
    input: z.string(),
    output: z.string(),
  }).refine(data => data.operables.includes(data.input), {
    message: "Input must be one of the operables",
  }).refine(data => data.operables.includes(data.output), {
    message: "Output must be one of the operables",
  });

  return of(schema);
};

export const inputSchema = (operable) => {
  const inputSchemaPlaceholder = z.any().describe("Dynamic input schema to be implemented");
  return of(inputSchemaPlaceholder);
};

export const outputSchema = (operable) => {
  const outputSchemaPlaceholder = z.any().describe("Dynamic output schema to be implemented");
  return of(outputSchemaPlaceholder);
};

const statusOperator = (operable) => {
  return tap({
    next: (statusEvent) => {
      if (statusEvent.detail && statusEvent.detail.nodeId) {
        operable.status$.next({
          status: statusEvent.status,
          message: statusEvent.message,
          detail: {
            ...statusEvent.detail,
            nodeId: `[flow-id]-${statusEvent.detail.nodeId}`
          }
        });
      }
    },
    error: (error) => {
      operable.status$.next({
        status: 'error',
        message: 'An error occurred in the flow',
        detail: error
      });
    }
  });
};

export default function FlowConstructor(operable) {
  const destroy$ = new Subject();
  const operables = new Map();
  const connections = new Map();

  const manageOperables = (config) => {
    config.operables.forEach(name => {
      if (!operables.has(name)) {
        const newOperable = {};
        operables.set(name, newOperable);
        operable.io.tools$.next([...operable.io.tools$.value, newOperable]);
      }
    });

    operables.forEach((_, name) => {
      if (!config.operables.includes(name)) {
        const toRemove = operables.get(name);
        operable.io.tools$.next(operable.io.tools$.value.filter(o => o !== toRemove));
        operables.delete(name);
      }
    });
  };

  const manageConnections = (config) => {
    [...config.connections.stream, ...config.connections.tools].forEach(({ from, to }) => {
      const connectionKey = `${from}-${to}`;
      if (!connections.has(connectionKey)) {
        const fromOperable = operables.get(from);
        const toOperable = operables.get(to);
        connections.set(connectionKey, {});
      }
    });

    connections.forEach((_, key) => {
      const [from, to] = key.split('-');
      if (!config.connections.stream.concat(config.connections.tools).some(c => c.from === from && c.to === to)) {
        connections.delete(key);
      }
    });
  };

  const setupFlow = () => {
    operable.schema.config$.pipe(
      takeUntil(destroy$),
      switchMap(configSchema => configSchema.pipe(
        withLatestFrom(operable.read.config$)
      )),
      tap(([schema, config]) => {
        schema.parse(config);
        manageOperables(config);
        manageConnections(config);
      })
    ).subscribe();

    operable.io.upstream$.pipe(
      takeUntil(destroy$),
      switchMap(input => {
        const inputOperable = operables.get(operable.read.config$.value.input);
        return of(input);
      }),
      tap(output => {
        const outputOperable = operables.get(operable.read.config$.value.output);
      })
    ).subscribe();

    operable.status$.pipe(
      takeUntil(destroy$),
      statusOperator(operable)
    ).subscribe();
  };

  setupFlow();

  return () => {
    destroy$.next();
    destroy$.complete();
  };
}