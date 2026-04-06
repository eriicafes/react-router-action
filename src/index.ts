import { useMemo } from "react";
import {
  data,
  type ActionFunctionArgs,
  type AppLoadContext,
  type UNSAFE_DataWithResponseInit as DataWithResponseInit,
} from "react-router";

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?:
      | ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
      | undefined;
  }

  export type InferSchemaInput<TSchema> =
    TSchema extends StandardSchemaV1<infer TInput, any> ? TInput : unknown;
  export type InferSchemaOutput<TSchema> =
    TSchema extends StandardSchemaV1<any, infer TOutput> ? TOutput : unknown;
}

type AnyStandardSchema = StandardSchemaV1<any, any>;

export type Action<
  TData,
  TError,
  TSchema extends AnyStandardSchema | undefined = undefined,
  TActionArgs = ActionFunctionArgs<AppLoadContext>,
> = {
  schema?: TSchema;
  handler(
    ctx: ActionContext<
      StandardSchemaV1.InferSchemaOutput<TSchema>,
      FieldErrors<TSchema>
    >,
    args: TActionArgs,
  ):
    | Promise<ActionOutput<TData, TError, TSchema>>
    | ActionOutput<TData, TError, TSchema>;
};

export type InferActionInput<T extends Action<any, any, any, any>> =
  T extends Action<any, any, infer TSchema, any>
    ? StandardSchemaV1.InferSchemaInput<TSchema>
    : never;
export type InferActionOutput<T extends Action<any, any, any, any>> =
  T extends Action<infer TData, any, any, any> ? TData : never;

export type ActionContext<TInput, TFieldErrors extends FieldErrors<any>> = {
  input: TInput;
  data<TData>(
    data: TData,
    init?: number | ResponseInit,
  ): {
    success: true;
    data: TData;
    init?: number | ResponseInit;
  };
  error<TError>(
    error: TError,
    init: number | ResponseInit,
    fieldErrors?: TFieldErrors,
  ): {
    success: false;
    error: TError;
    fieldErrors?: TFieldErrors;
    init: number | ResponseInit;
  };
};

type ActionOutput<
  TData,
  TError,
  TSchema extends AnyStandardSchema | undefined = undefined,
> =
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

type FieldErrors<TSchema> = TSchema extends AnyStandardSchema
  ? {
      [K in keyof StandardSchemaV1.InferSchemaInput<TSchema>]?: string[];
    } & {}
  : Record<string, string[]>;
type InferFieldErrors<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelect extends "first" | "all",
> = {
  [K in keyof NonNullable<
    Extract<TResult[TAction], { success: false }>["fieldErrors"]
  >]?: TSelect extends "first" ? string : string[];
} & {};

type OmitInit<T> = T extends any
  ? { [K in Exclude<keyof T, "init">]: T[K] }
  : never;

type InferActionsOutputs<
  TActions extends Record<string, Action<any, any, any, any>>,
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
  TSchema extends AnyStandardSchema | undefined = undefined,
  TActionArgs = ActionFunctionArgs<AppLoadContext>,
>(action: {
  schema?: TSchema;
  handler(
    ctx: ActionContext<
      StandardSchemaV1.InferSchemaOutput<TSchema>,
      FieldErrors<TSchema>
    >,
    args: TActionArgs,
  ):
    | Promise<ActionOutput<TData, TError, TSchema>>
    | ActionOutput<TData, TError, TSchema>;
}): Action<TData, TError, TSchema, TActionArgs> {
  return action;
}

export async function matchAction<
  TActions extends Record<
    string,
    Action<any, any, AnyStandardSchema | undefined, TActionArgs>
  >,
  TActionArgs extends ActionFunctionArgs<AppLoadContext>,
>(
  args: TActionArgs,
  formData: FormData,
  actions: TActions,
): Promise<DataWithResponseInit<InferActionsOutputs<TActions>>> {
  const actionsEntries = Object.entries(actions);
  if (!actionsEntries.length) {
    return data({}, 400);
  }

  const requestUrl = new URL(args.request.url);
  const actionName = requestUrl.searchParams.get("action") as keyof TActions;
  const action = actions[actionName];
  if (!action) {
    return data({}, 400);
  }

  const input = Object.fromEntries(formData);
  const result = action.schema
    ? await parseSchema(action.schema, input)
    : {
        success: true as const,
        data: input as StandardSchemaV1.InferSchemaOutput<typeof action.schema>,
      };

  if (result.success) {
    const output = await action.handler(
      {
        input: result.data,
        data(data, init) {
          return { success: true, data, init };
        },
        error(error, init, fieldErrors) {
          return { success: false, error, fieldErrors, init };
        },
      },
      args,
    );
    const init = output.init;
    delete output.init;
    return data(
      {
        [actionName]: output,
      } as InferActionsOutputs<TActions>,
      init,
    );
  }

  return data(
    {
      [actionName]: {
        success: false,
        fieldErrors: flattenIssues(result.issues),
      },
    } as InferActionsOutputs<TActions>,
    400,
  );
}

export function routeAction<
  TActions extends Record<string, Action<any, any, any, any>>,
>(actions: TActions) {
  return async (args: ActionFunctionArgs) => {
    const formData = await args.request.formData();
    return matchAction(args, formData, actions);
  };
}

type ActionResult<TData, TError, TFieldErrors> =
  | { success: true; data: TData; error?: never; fieldErrors?: never }
  | { success: false; data?: never; error?: TError; fieldErrors?: TFieldErrors }
  | { success: undefined; data?: never; error?: never; fieldErrors?: never };

export function actionResult<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelectErrors extends "first" | "all" = "first",
>(
  result: TResult | undefined,
  action: TAction,
  options?: { errors?: TSelectErrors },
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
    fieldErrors = Object.entries(
      fieldErrors as Record<string, string[] | undefined>,
    ).reduce(
      (acc, [field, errors]) => {
        const error = errors?.[0];
        if (error) acc[field] = error;
        return acc;
      },
      {} as Record<string, string>,
    ) as InferFieldErrors<TResult, TAction, TSelectErrors>;
  }
  return { success: false, error: actionResult.error, fieldErrors };
}

export function useActionResult<
  TResult extends Record<string, ActionOutput<any, any, any>>,
  TAction extends keyof TResult,
  TSelectErrors extends "first" | "all" = "first",
>(
  result: TResult | undefined,
  action: TAction,
  options?: { errors?: TSelectErrors },
) {
  return useMemo(
    () => actionResult(result, action, { errors: options?.errors }),
    [result, action, options?.errors],
  );
}

async function parseSchema<TSchema extends AnyStandardSchema>(
  schema: TSchema,
  input: unknown,
): Promise<
  | { success: true; data: StandardSchemaV1.InferSchemaOutput<TSchema> }
  | { success: false; issues: readonly StandardSchemaV1.Issue[] }
> {
  const result = await schema["~standard"].validate(input);
  if (result.issues !== undefined) {
    return { success: false, issues: result.issues };
  }
  return {
    success: true,
    data: result.value as StandardSchemaV1.InferSchemaOutput<TSchema>,
  };
}

function flattenIssues(issues: readonly StandardSchemaV1.Issue[]) {
  return issues.reduce(
    (acc, issue) => {
      const segment = issue.path?.[0];
      const key = typeof segment === "object" ? segment.key : segment;
      if (key === undefined) return acc;

      const field = String(key);
      if (!acc[field]?.length) acc[field] = [issue.message];
      else acc[field].push(issue.message);
      return acc;
    },
    {} as Record<string, string[]>,
  );
}
