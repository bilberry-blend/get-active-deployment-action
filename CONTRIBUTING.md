# Contributing

We welcome contributions to this project.
Before contributing you should:

- Familiarize yourself with how [GitHub JavaScript Actions work](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action).
- [Open an issue](/issues/new) to discuss the contribution you want to make.

## Scope of action

This action was created to support the Turbo Monorepo GitHub setup used by Adventure Tech.
While we built it to be general enough to support other GitHub users as well, we do not intend to support all possible use cases.

We may reject contributions that are outside the scope of this action.
In such cases feel free to make a fork under the terms of the MIT license.

Changes should preferably be non-breaking and backwards compatible.
New behaviour should be opt-in and not change the default behaviour of the action.
We will consider breaking changes if the benefits are significant enough.

## Testing

The project makes use of tests to ensure that the code works as expected.
We do not require 100% test coverage, but we do require that all new code is covered by tests.
