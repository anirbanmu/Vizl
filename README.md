# [Vizl](https://vizl.anirbanmu.com)

A simple music visualiser for SoundCloud® tracks using [WebGL](https://get.webgl.org/), [Svelte](https://svelte.dev/) & [Typescript](https://www.typescriptlang.org/).

To see it in action, go [here](https://vizl.anirbanmu.com), enter a link like this [one](https://soundcloud.com/nocopyrightsounds/alan-walker-fade-ncs-release) from SoundCloud®, and hit the plus button!

## Development

- Make sure you have [Node](https://nodejs.org/en/download/package-manager/) & npm [installed](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Clone the repo
- `cd` into repo directory
- `npm install`

...then start the dev server [Rollup](https://rollupjs.org) + [Express](https://expressjs.com/):

```bash
npm run dev
```

Navigate to [localhost:8081](http://localhost:8081). You should see Vizl running. Edit a component file in `src`, save it, and reload the page to see your changes.

If you're using [Visual Studio Code](https://code.visualstudio.com/) we recommend installing the official extension [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode). If you are using other editors you may need to install a plugin in order to get syntax highlighting and intellisense.

## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can run the newly built app with `npm run start`. This uses [Express](https://expressjs.com/) to serve the built [Svelte](https://svelte.dev/) app.

## [fly.io](https://fly.io/)

To run this on fly.io:

- Create an app with [flyctl](https://fly.io/docs/flyctl/installing/) and replace the <APP-NAME> in fly.toml.
- `flyctl secrets set SOUNDCLOUD_CLIENT_ID=<SOUNDCLOUD-CLIENT-ID>`
- `flyctl secrets set SOUNDCLOUD_CLIENT_SECRET=<SOUNDCLOUD-CLIENT-SECRET>`
- `flyctl deploy`

### Details

This app was originally written in plain Javascript with jQuery. There's a legacy unmaintained branch with said legacy code [here](https://github.com/anirbanmu/Vizl/tree/legacy).
