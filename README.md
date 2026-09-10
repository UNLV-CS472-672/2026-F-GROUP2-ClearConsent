# 2026-F-GROUP2-ClearConsent

ClearConsent: Privacy Translator & Data Footprint Map

## Prerequisites

This project requires **Node.js `^22.13.0 || >=24`**. The floor is set by our
toolchain: `wrangler` and `miniflare` require Node 22+, and `eslint` requires
22.13+ on the v22 line. Node 20 and Node 23 are not supported.

Because `.npmrc` sets `engine-strict=true`, `npm install` will fail outright on
an unsupported version rather than installing a broken tree.

If you use [nvm](https://github.com/nvm-sh/nvm), the pinned version in `.nvmrc`
will get you a supported runtime:

```sh
nvm install
nvm use
```

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.17.0 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:none" sveltekit-adapter="adapter:cloudflare+cfTarget:workers" --install npm .
```

## Developing

Once you've confirmed you're on a supported Node version (see
[Prerequisites](#prerequisites)) and installed dependencies with `npm install`,
start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
