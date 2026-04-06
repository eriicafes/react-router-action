# react-router-action

## 2.0.0

### Major Changes

- f389aec: Read the action discriminator from the `action` query param instead of the `_action` form field.

  This is a breaking change:

  - forms and fetchers should submit to URLs like `?action=name`
  - `_action` in form data is no longer used to select the action
  - `matchAction` now expects `FormData` to be passed in directly, so callers using `matchAction` must call `request.formData()` themselves
  - `routeAction` continues to read and pass `request.formData()` for you

### Minor Changes

- f389aec: Use standard schema validation

## 1.0.2

### Patch Changes

- 3d71817: Add guide on returning responses

## 1.0.1

### Patch Changes

- ed132e8: Add npm keywords
