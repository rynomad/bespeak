import { BehaviorSubject, combineLatest, merge, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { z } from 'zod';

export const key = "FlowConstructor";
export const version = "1.0.0";
export const description = "This operator encapsulates a flow of other operables.";

export const configSchema = (operable) => {
  const schema = z.object({
    operables: z.array(z.string()).min(1, "At least one operable is required"),
    connections: z.object({
      stream: z.array(z.object({
        from: z.string(),
        to: z.string(),
      })),
      tools: z.array(z.object({
        from: z.string(),
        to: z.string(),
      })),
    }),
    input: z.string(),
    output: z.string(),
  }).refine(data => data.operables.includes(data.input), {
    message: "Input must be one of the operables",
    path: ["input"],
  }).refine(data => data.operables.includes(data.output), {
    message: "Output must be one of the operables",
    path: ["output"],
  });

  return of(schema);
};

export const inputSchema = (operable) => {
  const placeholderSchema = z.any();
  return of(placeholderSchema);
};

export const outputSchema = (operable) => {
  const placeholderSchema = z.any();
  return of(placeholderSchema);
};

const toolOperator = (operable) => {
  const tools$ = new BehaviorSubject([]);

  const subscription = operable.schema.config$.pipe(
    distinctUntilChanged(),
    switchMap(config => {
      const toolOperables = config.operables.map(name => ({
        id: `${operable.id}-${name}`,
        ...operable,
      }));
      return combineLatest(toolOperables.map(tool => tool.asOperator()));
    }),
    map(operators => operators.filter(op => op != null))
  ).subscribe(tools => {
    tools$.next(tools);
  });

  return tools$;
};

const statusOperator = (operable, tools$) => {
  const statusSubscriptions = tools$.pipe(
    map(toolOperables => {
      return merge(
        ...toolOperables.map(tool => tool.status$.pipe(
          map(statusEvent => ({
            ...statusEvent,
            detail: { ...statusEvent.detail, nodeId: tool.id }
          }))
        ))
      );
    })
  );

  statusSubscriptions.subscribe(statusEvent => {
    operable.status$.next(statusEvent);
  });

  return statusSubscriptions;
};

export default function FlowConstructor(operable) {
  const tools$ = toolOperator(operable);
  const status$ = statusOperator(operable, tools$);

  operable.schema.config$.pipe(
    tap(config => {
      const inputOperable = tools$.getValue().find(tool => tool.id === `${operable.id}-${config.input}`);
      const outputOperable = tools$.getValue().find(tool => tool.id === `${operable.id}-${config.output}`);

      if (inputOperable) {
        operable.io.upstream$.subscribe(inputOperable.io.upstream$);
      }

      if (outputOperable) {
        outputOperable.io.downstream$.subscribe(operable.io.downstream$);
      }
    })
  ).subscribe();

  return {
    tools$,
    status$,
  };
}