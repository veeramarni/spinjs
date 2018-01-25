import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ES6Plugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    if (
      builder.stack.hasAll(['es6', 'webpack']) &&
      (!builder.stack.hasAny('dll') || builder.stack.hasAny(['android', 'ios']))
    ) {
      if (builder.stack.hasAny('es6') && !builder.stack.hasAny('dll')) {
        builder.config = spin.merge(
          {
            entry: {
              index: ['babel-polyfill']
            }
          },
          builder.config
        );
      }

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.exclude = /node_modules/;
      jsRule.use = {
        loader: builder.require.resolve('babel-loader'),
        options: spin.merge(
          {
            babelrc: false,
            cacheDirectory:
              builder.cache === false || (builder.cache === 'auto' && !spin.dev)
                ? false
                : path.join(builder.cache === true ? '.cache' : builder.cache, 'babel-loader'),
            compact: !spin.dev,
            presets: ([
              builder.require.resolve('babel-preset-react'),
              [builder.require.resolve('babel-preset-env'), { modules: false }],
              builder.require.resolve('babel-preset-stage-0')
            ] as any[]).concat(spin.dev ? [] : [[builder.require.resolve('babel-preset-minify'), { mangle: false }]]),
            plugins: [
              builder.require.resolve('babel-plugin-transform-runtime'),
              builder.require.resolve('babel-plugin-transform-decorators-legacy'),
              builder.require.resolve('babel-plugin-transform-class-properties')
            ],
            only: jsRuleFinder.extensions.map(ext => '*.' + ext)
          },
          builder.babelConfig
        )
      };
    }
  }
}
