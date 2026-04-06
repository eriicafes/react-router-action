---
"react-router-action": major
---

Read the action discriminator from the `action` query param instead of the `_action` form field.

This is a breaking change:

- forms and fetchers should submit to URLs like `?action=name`
- `_action` in form data is no longer used to select the action
- `matchAction` now expects `FormData` to be passed in directly, so callers using `matchAction` must call `request.formData()` themselves
- `routeAction` continues to read and pass `request.formData()` for you
