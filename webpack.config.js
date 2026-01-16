/**
 * Adapted from angular2-webpack-starter
 */

const helpers = require('./config/helpers'),
    webpack = require('webpack');

module.exports = {
    mode: 'production',
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },

    entry: helpers.root('src/index.ts'),

    output: {
        path: helpers.root('bundles'),
        publicPath: '/',
        filename: 'index.umd.js',
        libraryTarget: 'umd',
        library: 'c8osdkjscore'
    },

    // require those dependencies but don't bundle them
    externals: [/^rxjs(\/.*)?$/, 'pouchdb-browser'],

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [{
                loader: 'ts-loader',
                options: {
                    configFile: helpers.root('tsconfig.json')
                }
            }],
            exclude: /node_modules/
        }]
    }
};
