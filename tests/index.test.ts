import type { AppLoadContext, Params } from "react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actionResult, createAction, matchAction } from "../src";

describe("Action", () => {
  const test = createAction({
    schema: z.object({
      data: z.coerce.number({
        invalid_type_error: "expected number",
      }),
    }),
    handler(ctx, args: RouteArgs<{ id: string }>) {
      if (ctx.input.data.toString() !== args.params.id) {
        return ctx.error("Invalid data", 403, {
          data: ["data and id param must match"],
        });
      }
      return ctx.data(
        {
          id: args.params.id,
          data: ctx.input.data,
        },
        200
      );
    },
  });
  const ping = createAction({
    schema: z.object({}),
    handler(ctx) {
      return ctx.data("pong");
    },
  });

  type RouteArgs<TParams = Params, TContext = AppLoadContext> = {
    request: Request;
    params: TParams;
    context: TContext;
  };
  const makeRequest = (params: { id: string }, formData: FormData) => {
    const args: RouteArgs<{ id: string }> = {
      request: new Request(`http://localhost/${params.id}`, {
        method: "POST",
        body: formData,
      }),
      params: params,
      context: {},
    };
    return matchAction(args, {
      test,
      ping,
    });
  };

  it("returns successful response", async () => {
    const formData = new FormData();
    formData.append("_action", "test");
    formData.append("data", "1");
    const response = await makeRequest({ id: "1" }, formData);

    expect(response.init?.status).toStrictEqual(200);
    expect(response.data).toStrictEqual({
      test: {
        success: true,
        data: {
          id: "1",
          data: 1,
        },
      },
    });
    const result = actionResult(response.data, "test");
    expect(result.success).toStrictEqual(true);
    expect(result.data).toStrictEqual({
      id: "1",
      data: 1,
    });
    expect(result.error).toStrictEqual(undefined);
    expect(result.fieldErrors).toStrictEqual(undefined);

    const formData2 = new FormData();
    formData2.append("_action", "ping");
    const response2 = await makeRequest({ id: "1" }, formData2);

    expect(response2.data).toStrictEqual({
      ping: {
        success: true,
        data: "pong",
      },
    });
    const result2 = actionResult(response2.data, "ping");
    expect(result2.success).toStrictEqual(true);
    expect(result2.data).toStrictEqual("pong");
    expect(result2.error).toStrictEqual(undefined);
    expect(result2.fieldErrors).toStrictEqual(undefined);
  });

  it("returns error response", async () => {
    const formData = new FormData();
    formData.append("_action", "test");
    formData.append("data", "1");
    const response = await makeRequest({ id: "2" }, formData);

    expect(response.init?.status).toStrictEqual(403);
    expect(response.data).toStrictEqual({
      test: {
        success: false,
        error: "Invalid data",
        fieldErrors: {
          data: ["data and id param must match"],
        },
      },
    });
    const result = actionResult(response.data, "test");
    expect(result.success).toStrictEqual(false);
    expect(result.data).toStrictEqual(undefined);
    expect(result.error).toStrictEqual("Invalid data");
    expect(result.fieldErrors).toStrictEqual({
      data: "data and id param must match",
    });
  });

  it("returns error response on invalid data", async () => {
    const formData = new FormData();
    formData.append("_action", "test");
    formData.append("data", "one");
    const response = await makeRequest({ id: "1" }, formData);

    expect(response.init?.status).toStrictEqual(400);
    expect(response.data).toStrictEqual({
      test: {
        success: false,
        fieldErrors: {
          data: ["expected number"],
        },
      },
    });
    const result = actionResult(response.data, "test");
    expect(result.success).toStrictEqual(false);
    expect(result.data).toStrictEqual(undefined);
    expect(result.error).toStrictEqual(undefined);
    expect(result.fieldErrors).toStrictEqual({
      data: "expected number",
    });
    const result2 = actionResult(response.data, "test", { errors: "all" });
    expect(result2.success).toStrictEqual(false);
    expect(result2.data).toStrictEqual(undefined);
    expect(result2.error).toStrictEqual(undefined);
    expect(result2.fieldErrors).toStrictEqual({
      data: ["expected number"],
    });
  });

  it("returns error response on missing _action", async () => {
    const formData = new FormData();
    formData.append("data", "1");
    const response = await makeRequest({ id: "1" }, formData);

    expect(response.init?.status).toStrictEqual(400);
    expect(response.data).toStrictEqual({});
    const result = actionResult(response.data, "test");
    expect(result.success).toStrictEqual(undefined);
    expect(result.data).toStrictEqual(undefined);
    expect(result.error).toStrictEqual(undefined);
    expect(result.fieldErrors).toStrictEqual(undefined);
  });
});
