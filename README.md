# React Router Action

React Router Action defines multiple actions per route and returns typed success and error results. Paired with React Router route module type inference you get fully typed RPC.

## Installation

```sh
npm i react-router-action
```

## Usage

### Create actions and export.

`createAction` accepts any Standard Schema compatible validator. It is also optional, and when omitted `ctx.input` defaults to `unknown`.

```tsx
import { createAction, routeAction } from "react-router-action";
import { z } from "zod";

const echo = createAction({
  schema: z.object({
    value: z.string(),
  }),
  handler(ctx) {
    return ctx.data(ctx.input.value);
  },
});

const ping = createAction({
  handler(ctx) {
    return ctx.data("pong");
  },
});

export const action = routeAction({
  echo,
  ping,
});
```

If you have other code to run in the action you may use `matchAction` instead.

```tsx
import { matchAction } from "react-router-action";
import type { Route } from "./+types/page";

export async function action(args: Route.ActionArgs) {
  // run other code
  const formData = await args.request.formData();

  return matchAction(args, formData, {
    echo,
    ping,
  });
}
```

When you call `matchAction` directly, you are responsible for reading the request body yourself. `routeAction` handles `request.formData()` for you.

### Submit with form or fetcher.

Use `actionResult` or `useActionResult` hook to reduce optional chaining.
[Field errors](#field-errors) are also flattened by default to return just the first error.

#### With form

```tsx
import { Form } from "react-router";
import { useActionResult } from "react-router-action";
import type { Route } from "./+types/page";

export default function Page({ actionData }: Route.ComponentProps) {
  const echoResult = useActionResult(actionData, "echo");

  return (
    <Form method="POST" action="?action=echo">
      <div>
        <input type="text" name="value" />
        {echoResult.fieldErrors?.value && <p>{echoResult.fieldErrors.value}</p>}
      </div>

      {echoResult.error && <p>Error: {echoResult.error}</p>}
      {echoResult.success && <p>Last submit: {echoResult.data}</p>}
      <button>Submit</button>
    </Form>
  );
}
```

#### With fetcher.

```tsx
import { useFetcher } from "react-router";
import { useActionResult } from "react-router-action";

export default function Page() {
  const fetcher = useFetcher<typeof import("./page").action>();
  const echoResult = useActionResult(fetcher.data, "echo");

  return (
    <>
      <fetcher.Form method="POST" action="?action=echo">
        <div>
          <input type="text" name="value" />
          {echoResult.fieldErrors?.value && (
            <p>{echoResult.fieldErrors.value}</p>
          )}
        </div>

        {echoResult.error && <p>Error: {echoResult.error}</p>}
        {echoResult.success && <p>Last submit: {echoResult.data}</p>}
        <button>Submit</button>
      </fetcher.Form>

      <button
        type="button"
        onClick={() =>
          fetcher.submit(
            { value: "hello" },
            { method: "post", action: "?action=echo" },
          )
        }
      >
        Submit with fetcher.submit
      </button>
    </>
  );
}
```

## Returning Responses

Return a response using `data` or `error`. You can also pass status code or response headers. By default a `200` status code is sent for `data` responses while `error` responses require an explcit status code. Error responses can also contain [field errors](#field-errors).

```tsx
const ping = createAction({
  handler(ctx) {
    // data response with status
    const res1 = ctx.data("pong", 200);

    // data response with status and headers
    const res2 = ctx.data("pong", {
      status: 200,
      headers: {
        // ...custom headers
      },
    });

    // error response with status
    const res2 = ctx.error("failed", 400);

    // error response with status and field errors
    const res2 = ctx.error("failed", 400, {
      // ...field errors
    });
  },
});
```

Throw responses like redirects so they don't affect the returned type.

```tsx
const ping = createAction({
  handler(ctx) {
    throw redirect("/login");
  },
});
```

## Field Errors

Field errors are returned with a `400` status code when input validation fails.
You can also return explicit field errors in the action handler.

```tsx
const echo = createAction({
  schema: z.object({
    value: z.string(),
  }),
  handler(ctx, args: Route.ActionArgs) {
    if (ctx.input.value !== args.params.id) {
      return ctx.error("Invalid data", 400, {
        value: ["value must match id param"],
      });
    }
    return ctx.data(ctx.input.value);
  },
});
```

When using `actionResult` or `useActionResult` the fieldErrors are flattened to return only the first error by default. See the example below to return an array of errors.

```tsx
import { Form } from "react-router";
import { useActionResult } from "react-router-action";
import type { Route } from "./+types/page";

export default function Page({ actionData }: Route.ComponentProps) {
  const echoResult = useActionResult(actionData, "echo", { errors: "all" });

  return (
    <Form method="POST" action="?action=echo">
      <div>
        <input type="text" name="value" />
        {echoResult.fieldErrors?.value && (
          <ul>
            {echoResult.fieldErrors.value.map((error) => (
              <li>{error}</li>
            ))}
          </ul>
        )}
      </div>

      {echoResult.error && <p>Error: {echoResult.error}</p>}
      {echoResult.success && <p>Last submit: {echoResult.data}</p>}
      <button>Submit</button>
    </Form>
  );
}
```

## Action Args

Action args is the second argument to the action handler.
Explicitly type action args to use auto-generated types.

```tsx
import { createAction } from "react-router-action";
import { z } from "zod";
import type { Route } from "./+types/page";

const echo = createAction({
  schema: z.object({
    value: z.string(),
  }),
  handler(ctx, args: Route.ActionArgs) {
    // action args is typed correctly
  },
});
```
