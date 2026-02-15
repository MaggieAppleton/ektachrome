import { ektachromePlugin } from './server/vite-plugin.js';

export default {
  plugins: [
    ektachromePlugin({
      include: ['test/**/*.css', 'src/**/*.css'],
      exclude: ['node_modules/**']
    })
  ],
  server: {
    fs: {
      // Allow serving files from the project root, including .env
      allow: ['..']
    }
  }
};
