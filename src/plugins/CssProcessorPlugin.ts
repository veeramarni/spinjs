import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

const postCssDefaultConfig = (spin: Spin) => {
  return {
    plugins: () => [
      spin.require('autoprefixer')({
        browsers: ['last 2 versions', 'ie >= 9']
      })
    ]
  };
};

export default class CssProcessorPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;
    const dev = spin.dev;

    if (stack.hasAll('webpack') && !stack.hasAny('dll')) {
      let createRule;
      const rules = [];
      const postCssLoader = spin.require.probe('postcss-loader');
      const useDefaultPostCss: boolean = spin.options.useDefaultPostCss || false;

      let plugin;

      if (stack.hasAny('server')) {
        createRule = (ext, ruleList) => ({
          test: new RegExp(`\\.${ext}$`),
          use: [
            { loader: spin.require.resolve('isomorphic-style-loader') },
            { loader: spin.require.resolve('css-loader'), options: { sourceMap: true } }
          ]
            .concat(
              postCssLoader
                ? {
                    loader: postCssLoader,
                    options: useDefaultPostCss
                      ? { ...postCssDefaultConfig(spin), sourceMap: true }
                      : { sourceMap: true }
                  }
                : []
            )
            .concat(ruleList)
        });
      } else if (stack.hasAny('web')) {
        let ExtractTextPlugin;
        if (!dev) {
          ExtractTextPlugin = spin.require('extract-text-webpack-plugin');
        }
        createRule = (ext, ruleList) => {
          if (!dev && !plugin) {
            plugin = new ExtractTextPlugin({ filename: `[name].[contenthash].css` });
          }
          return {
            test: new RegExp(`\\.${ext}$`),
            use: dev
              ? [
                  { loader: spin.require.resolve('style-loader') },
                  { loader: spin.require.resolve('css-loader'), options: { sourceMap: true, importLoaders: 1 } }
                ]
                  .concat(
                    postCssLoader
                      ? {
                          loader: postCssLoader,
                          options: useDefaultPostCss
                            ? { ...postCssDefaultConfig(spin), sourceMap: true }
                            : { sourceMap: true }
                        }
                      : []
                  )
                  .concat(ruleList)
              : plugin.extract({
                  fallback: spin.require.resolve('style-loader'),
                  use: [
                    {
                      loader: spin.require.resolve('css-loader'),
                      options: { importLoaders: postCssLoader ? 1 : 0 }
                    }
                  ]
                    .concat(
                      postCssLoader
                        ? {
                            loader: postCssLoader,
                            options: useDefaultPostCss ? postCssDefaultConfig(spin) : {}
                          } as any
                        : []
                    )
                    .concat(ruleList ? ruleList.map(rule => rule.loader) : [])
                })
          };
        };
      }

      if (createRule && stack.hasAny('css')) {
        rules.push(createRule('css', []));
      }

      if (createRule && stack.hasAny('sass')) {
        rules.push(createRule('scss', [{ loader: spin.require.resolve(`sass-loader`), options: { sourceMap: true } }]));
      }

      if (createRule && stack.hasAny('less')) {
        rules.push(createRule('less', [{ loader: spin.require.resolve(`less-loader`), options: { sourceMap: true } }]));
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules
        }
      });

      if (plugin) {
        builder.config.plugins.push(plugin);
      }
    }
  }
}
