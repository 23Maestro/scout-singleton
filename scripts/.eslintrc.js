module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script', // Use 'script' for CommonJS
  },
  rules: {
    'no-console': 'off', // Allow console.log in scripts
    'prefer-const': 'error',
    'no-unused-vars': 'warn',
  },
};
