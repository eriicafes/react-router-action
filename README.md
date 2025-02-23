# React Router Action

React Router Action defines multiple actions per route and returns typed success and error results. Paired with React Router route module type inference you get fully typed RPC.

## Installation

```sh
npm i react-router-action
```

## Usage

### Create actions and export.

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
  schema: z.object({}),
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
  return matchAction(args, {
    echo,
    ping,
  });
}
```

### Submit with form or fetcher.

```tsx
import { Form } from "react-router";
import type { Route } from "./+types/page";

export default function Page({ actionData }: Route.ComponentProps) {
  return (
    <Form method="POST">
      <input type="hidden" name="_action" value="echo" />
      <div>
        <input type="text" name="value" />
        {actionData?.echo?.fieldErrors?.value && (
          <p>{actionData.echo.fieldErrors.value[0]}</p>
        )}
      </div>

      {actionData?.echo?.error && <p>Error: {actionData.echo.error}</p>}
      {actionData?.echo?.success && <p>Last submit: {actionData.echo.data}</p>}
      <button>Submit</button>
    </Form>
  );
}
```

Use `actionResult` or `useActionResult` hook to reduce optional chaining.
[Field errors](#field-errors) are also flattened by default to return just the first error.

```tsx
import { Form } from "react-router";
import { useActionResult } from "react-router-action";
import type { Route } from "./+types/page";

export default function Page({ actionData }: Route.ComponentProps) {
  const echoResult = useActionResult(actionData, "echo");

  return (
    <Form method="POST">
      <input type="hidden" name="_action" value="echo" />
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

## Action Args

Action args is the secod argument to the action handler.
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

## Field Errors

Field errors are returned with a `400` status code when input validation fails.
You can also return explicit field errors in the route handler.

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
    <Form method="POST">
      <input type="hidden" name="_action" value="echo" />
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
