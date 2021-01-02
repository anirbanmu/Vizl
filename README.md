# [Vizl](https://vizl.anirbanmu.com)

A simple music visualiser for Soundcloud tracks using [WebGL](https://get.webgl.org/), [Svelte](https://svelte.dev/) & [Typescript](https://www.typescriptlang.org/).

To see it in action, go [here](https://vizl.anirbanmu.com), enter a link like this [one](https://soundcloud.com/nocopyrightsounds/alan-walker-fade-ncs-release) from Soundcloud, and hit the plus button!

## Development

- Make sure you have [Node](https://nodejs.org/en/download/package-manager/) & [yarn](https://yarnpkg.com/lang/en/docs/install) installed
- Clone the repo
- `cd` into repo directory
- `yarn install`

...then start [Rollup](https://rollupjs.org):
```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). You should see Vizl running. Edit a component file in `src`, save it, and reload the page to see your changes.

By default, the server will only respond to requests from localhost. To allow connections from other computers, edit the `sirv` commands in package.json to include the option `--host 0.0.0.0`.

If you're using [Visual Studio Code](https://code.visualstudio.com/) we recommend installing the official extension [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode). If you are using other editors you may need to install a plugin in order to get syntax highlighting and intellisense.

## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can run the newly built app with `npm run start`. This uses [sirv](https://github.com/lukeed/sirv), which is included in your package.json's `dependencies` so that the app will work when you deploy to platforms like [Heroku](https://heroku.com).

### Details

This app was originally written in plain Javascript with jQuery. There's a legacy unmaintained branch with said legacy code [here](https://github.com/anirbanmu/Vizl/tree/legacy).
