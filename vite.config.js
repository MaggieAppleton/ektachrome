import { ektachromePlugin } from './server/vite-plugin.js';

export default {
  plugins: [
    ektachromePlugin({
      include: ['test/**/*.css', 'src/**/*.css'],
      exclude: ['node_modules/**']
    })
  ]
};
