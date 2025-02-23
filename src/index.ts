import { useMemo } from "react";
import {
  data,
  type ActionFunctionArgs,
  type AppLoadContext,
  type UNSAFE_DataWithResponseInit as DataWithResponseInit,
} from "react-router";
import { z, type AnyZodObject } from "zod";

export type Action<
  TData,
  TError,
  TSchema extends AnyZodObject,
  TActionArgs = ActionFunctionArgs<AppLoadContext>
> = {
  schema: TSchema;
  handler(
    ctx: ActionContext<z.output<TSchema>, FieldErrors<TSchema>>,
    args: TActionArgs
  ):
    | Promise<ActionOutput<TData, TError, TSchema>>
    | ActionOutput<TData, TError, TSchema>;
};

export type InferActionInput<T extends Action<any, any, any, any>> =
  T extends Action<any, any, infer TSchema, any> ? z.input<TSchema> : never;
export type InferActionOutput<T extends Action<any, any, any, any>> =
  T extends Action<infer TData, any, any, any> ? TData : never;

type ActionContext<TInput, TFieldErrors extends FieldErrors<any>> = {
  input: TInput;
  data<TData>(
    data: TData,
    init?: number | ResponseInit
  ): {
    success: true;
    data: TData;
    init?: number | ResponseInit;
  };
  error<TError>(
    error: TError,
    init: number | ResponseInit,
    fieldErrors?: TFieldErrors
  ): {
    success: false;
    error: TError;
    fieldErrors?: TFieldErrors;
    init: number | ResponseInit;
  };
};

type ActionOutput<TData, TError, TSchema extends AnyZodObject> =
  | {
      success: true;
      data: TData;
      error?: never;
      fieldErrors?: never;
      init?: number | ResponseInit;
    }
  | {
      success: false;
      data?: never;
      error?: TError;
      fieldErrors?: FieldErrors<TSchema>;
      init?: number | ResponseInit;
    };

type FieldErrors<TSchema extends AnyZodObject> = {
  [K in keyof z.input<TSchema>]?: string[];
} & {};
type OmitInit<T> = T extends any
  ? { [K in Exclude<keyof T, "init">]: T[K] }
  : never;

type InferActionsOutputs<
  TActions extends Record<string, Action<any, any, any, any>>
> = {
  [K in keyof TActions]?: TActions[K] extends Action<
    infer TData,
    infer TError,
    infer TSchema,
    any
  >
    ? OmitInit<ActionOutput<TData, TError, TSchema>>
    : never;
} & {};

export function createAction<
  TData,
  TError,
  TSchema extends AnyZodObject,
  TActionArgs = ActionFunctionArgs<AppLoadContext>
>(action: {
  schema: TSchema;
  handler(
    ctx: ActionContext<z.output<TSchema>, FieldErrors<TSchema>>,
    args: TActionArgs
  ):
    | Promise<ActionOutput<TData, TError, TSchema>>
    | ActionOutput<TData, TError, TSchema>;
}): Action<TData, TError, TSchema, TActionArgs> {
  return action;
}

export async function matchAction<
  TActions extends Record<string, Action<any, any, AnyZodObject, TActionArgs>>,
  TActionArgs extends ActionFunctionArgs<AppLoadContext>
>(
  args: TActionArgs,
  actions: TActions
): Promise<DataWithResponseInit<InferActionsOutputs<TActions>>> {
  const actionsEntries = Object.entries(actions);
  if (!actionsEntries.length) {
    return data({}, 400);
  }

  const [first, ...rest] = actionsEntries.map(([name, action]) => {
    return action.schema.extend({ _action: z.literal(name) });
  });
  const schema = z.discriminatedUnion("_action", [first, ...rest]);
  const formData = await args.request.clone().formData();
  const result = await schema.spa(Object.fromEntries(formData));

  if (result.success) {
    const action = result.data._action as keyof TActions;
    const output = await actions[action].handler(
      {
        input: result.data,
        data(data, init) {
          return { success: true, data, init };
        },
        error(error, init, fieldErrors) {
          return { success: false, error, fieldErrors, init };
        },
      },
      args
    );
    const init = output.init;
    delete output.init;
    return data(
      {
        [action]: output,
      } as InferActionsOutputs<TActions>,
      init
    );
  }

  const action = formData.get("_action");
  if (typeof action === "string" && action in actions) {
    return data(
      {
        [action]: {
          success: false,
          fieldErrors: result.error.flatten().fieldErrors,
        },
      } as InferActionsOutputs<TActions>,
      400
    );
  }
  return data({}, 400);
}

export function routeAction<
  TActions extends Record<string, Action<any, any, any, any>>
>(actions: TActions) {
  return (args: ActionFunctionArgs) => matchAction(args, actions);
}

type InferFieldErrors<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelect extends "first" | "all"
> = {
  [K in keyof NonNullable<
    Extract<TResult[TAction], { success: false }>["fieldErrors"]
  >]?: TSelect extends "first" ? string : string[];
} & {};

type ActionResult<TData, TError, TFieldErrors> =
  | { success: true; data: TData; error?: never; fieldErrors?: never }
  | { success: false; data?: never; error?: TError; fieldErrors?: TFieldErrors }
  | { success: undefined; data?: never; error?: never; fieldErrors?: never };

export function actionResult<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelectErrors extends "first" | "all" = "first"
>(
  result: TResult | undefined,
  action: TAction,
  options?: { errors?: TSelectErrors }
): ActionResult<
  Extract<TResult[TAction], { success: true }>["data"],
  Extract<TResult[TAction], { success: false }>["error"],
  InferFieldErrors<TResult, TAction, TSelectErrors>
> {
  const actionResult = result?.[action];
  if (actionResult?.success === undefined) {
    return { success: undefined };
  }
  if (actionResult?.success) {
    return { success: true, data: actionResult.data };
  }

  let fieldErrors = actionResult.fieldErrors as
    | InferFieldErrors<TResult, TAction, TSelectErrors>
    | undefined;

  if (fieldErrors && options?.errors !== "all") {
    fieldErrors = Object.entries(fieldErrors).reduce((acc, [field, errors]) => {
      const error = errors?.[0];
      if (error) acc[field] = error;
      return acc;
    }, {} as Record<string, string>) as InferFieldErrors<
      TResult,
      TAction,
      TSelectErrors
    >;
  }
  return { success: false, error: actionResult.error, fieldErrors };
}

export function useActionResult<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelectErrors extends "first" | "all" = "first"
>(
  result: TResult | undefined,
  action: TAction,
  options?: { errors?: TSelectErrors }
) {
  return useMemo(
    () => actionResult(result, action, { errors: options?.errors }),
    [result, action, options?.errors]
  );
}
