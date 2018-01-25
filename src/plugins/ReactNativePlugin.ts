import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

let babelRegisterDone = false;

const registerBabel = (builder: Builder) => {
  if (!babelRegisterDone) {
    builder.require('babel-register')({
      presets: [builder.require.resolve('babel-preset-env'), builder.require.resolve('babel-preset-flow')],
      ignore: /node_modules(?!\/(haul|react-native))/,
      retainLines: true,
      sourceMaps: 'inline'
    });
    builder.require('babel-polyfill');

    babelRegisterDone = true;
  }
};

export default class ReactNativePlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native', 'webpack'])) {
      registerBabel(builder);

      const webpack = builder.require('webpack');

      const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf)$/;

      const AssetResolver = builder.require('haul/src/resolvers/AssetResolver');
      const HasteResolver = builder.require('haul/src/resolvers/HasteResolver');

      const reactNativeRule = {
        loader: builder.require.resolve('babel-loader'),
        options: spin.merge(
          {
            babelrc: false,
            cacheDirectory:
              builder.cache === false || (builder.cache === 'auto' && !spin.dev)
                ? false
                : path.join(builder.cache === true ? '.cache' : builder.cache, 'babel-loader'),
            compact: !spin.dev,
            presets: ([builder.require.resolve('babel-preset-expo')] as any[]).concat(
              spin.dev ? [] : [[builder.require.resolve('babel-preset-minify'), { mangle: false }]]
            ),
            plugins: [builder.require.resolve('haul/src/utils/fixRequireIssues')]
          },
          builder.babelConfig
        )
      };

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.exclude = /node_modules\/(?!react-native.*|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/;
      const origUse = jsRule.use || require.resolve('./shared/identity-loader');
      jsRule.use = req => (req.resource.indexOf('node_modules') >= 0 ? reactNativeRule : origUse);

      builder.config.resolve.extensions = [`.${stack.platform}.`, '.native.', '.']
        .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
        .reduce((acc, val) => acc.concat(val));

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            { parser: { requireEnsure: false } },
            {
              test: mobileAssetTest,
              use: {
                loader: require.resolve('./react-native/assetLoader'),
                query: {
                  platform: stack.platform,
                  root: path.resolve('.'),
                  cwd: spin.cwd,
                  bundle: false
                }
              }
            }
          ]
        },
        resolve: {
          plugins: [
            new HasteResolver({
              directories: [builder.require.resolve('react-native')]
            }),
            new AssetResolver({
              platform: stack.platform,
              test: mobileAssetTest
            })
          ],
          mainFields: ['react-native', 'browser', 'main']
        },
        target: 'webworker'
      });

      const reactVer = builder.require('react-native/package.json').version.split('.')[1] >= 43 ? 16 : 15;
      if (stack.hasAny('dll')) {
        builder.config = spin.merge(builder.config, {
          entry: {
            vendor: [builder.require.resolve(`spinjs/react-native-polyfills/react-native-polyfill-${reactVer}.js`)]
          }
        });
      } else {
        const idx = builder.config.entry.index.indexOf('babel-polyfill');
        if (idx >= 0) {
          builder.config.entry.index.splice(idx, 1);
        }
        builder.config = spin.merge(
          {
            plugins: builder.sourceMap
              ? [
                  new webpack.SourceMapDevToolPlugin({
                    test: new RegExp(`\\.bundle$`),
                    filename: '[file].map'
                  })
                ]
              : [],
            entry: {
              index: [builder.require.resolve(`spinjs/react-native-polyfills/react-native-polyfill-${reactVer}.js`)]
            }
          },
          builder.config
        );
      }
    }
  }
}
